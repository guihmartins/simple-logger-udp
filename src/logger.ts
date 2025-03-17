import pino from 'pino';
import * as dgram from 'dgram';
import { v4 as uuidv4 } from 'uuid';
import os from 'os';
import { getValue } from './environment';

// Interface para padronizar o formato do log
export interface StandardLogFormat {
    version: string;
    host: string;
    short_message: string;
    full_message?: string;
    timestamp: number;
    level?: number;
    _application_name?: string;
    _environment?: string;
    _product_name?: string;
    _service_name?: string;
    _error_code?: string | null;
    _error_message?: string | null;
    _correlation_id?: string;
    // Outros campos opcionais que podem ser incluídos quando necessário
    [key: string]: any;
}

// Configuração do Graylog
const graylogConfig = {
    host: getValue('graylogHost'),
    port: getValue('graylogPort'),
    product: getValue('graylogProduct'),
    applicationName: getValue('graylogApplicationName'),
    environment: getValue('graylogEnvironment'),
    enabled: getValue('graylogEnabled') 
};

// Valores padrão para os logs - Garantindo que valores obrigatórios não sejam undefined
const defaultLogValues: StandardLogFormat = {
    version: "1.1",
    host: os.hostname() || "unknown-host",
    short_message: "",  // Será substituído na função formatLog
    timestamp: 0,       // Será substituído na função formatLog
    _application_name: graylogConfig.applicationName || "default-app",
    _environment: graylogConfig.environment || "development",
    _product: graylogConfig.product || "default-product",
    _service_name: graylogConfig.applicationName || "default-app",
    _service_version: "1.0.0"
};

// Níveis de log (Syslog)
const LOG_LEVELS = {
    fatal: 2,  // critical
    error: 3,  // error
    warn: 4,   // warning
    info: 6,   // info
    debug: 7   // debug
};

// Mapeamento invertido para converter número em string
const LOG_LEVEL_NAMES: {[key: number]: string} = {
    2: 'fatal',
    3: 'error',
    4: 'warn',
    6: 'info',
    7: 'debug'
};

// Função para verificar se um nível de log deve ser exibido
function shouldLog(logLevel: number): boolean {
    const configLogLevel = getValue('graylogLogLevel') || 'info';
    const configLevelValue = LOG_LEVELS[configLogLevel as keyof typeof LOG_LEVELS];
    
    // Se o nível do log for menor ou igual ao configurado, deve ser exibido
    // (Níveis menores são mais graves no padrão Syslog)
    return logLevel <= configLevelValue;
}

// Classe de transporte UDP para Graylog
class GraylogTransport {
    private client: dgram.Socket | null = null;
    private host: string;
    private port: number;
    private connected = false;
    private buffer: Array<{log: any, callback: () => void}> = [];
    private maxBufferSize = 100;
    private reconnectTimeout?: NodeJS.Timeout;

    constructor(host: string, port: number) {
        this.host = host;
        this.port = port;
        this.setupConnection();
    }

    private setupConnection() {
        try {
            this.client = dgram.createSocket('udp4');
            
            this.client.on('error', (err) => {
                console.error(`Erro no cliente UDP Graylog: ${err.message}`);
                this.connected = false;
                this.scheduleReconnect();
            });

            this.connected = true;
            
            // Processar buffer se houver mensagens pendentes
            this.processBuffer();
        } catch (error) {
            console.error(`Erro ao configurar cliente UDP: ${error instanceof Error ? error.message : String(error)}`);
            this.connected = false;
            this.scheduleReconnect();
        }
    }

    private scheduleReconnect() {
        if (this.reconnectTimeout) {
            clearTimeout(this.reconnectTimeout);
        }
        
        this.reconnectTimeout = setTimeout(() => {
            console.log("Tentando reconectar ao Graylog...");
            this.setupConnection();
        }, 30000); // Tenta reconectar a cada 30 segundos
    }

    private processBuffer() {
        if (this.buffer.length > 0 && this.connected && this.client) {
            const batch = this.buffer.splice(0, Math.min(10, this.buffer.length));
            
            batch.forEach(item => {
                this.sendLog(item.log);
                item.callback();
            });
            
            // Se ainda houver mais no buffer, agende o próximo processamento
            if (this.buffer.length > 0) {
                setTimeout(() => this.processBuffer(), 100);
            }
        }
    }

    write(log: any, callback: () => void) {
        if (!this.connected || !this.client) {
            // Adicionar ao buffer se não estiver conectado
            if (this.buffer.length < this.maxBufferSize) {
                this.buffer.push({log, callback});
            } else {
                // Buffer cheio, remova o mais antigo
                this.buffer.shift();
                this.buffer.push({log, callback});
            }
            return;
        }
        
        this.sendLog(log);
        callback();
    }

    private sendLog(log: any) {
        if (!this.client) return;
        
        try {
            // Garantir que o log está no formato JSON
            const logStr = typeof log === 'string' ? log : JSON.stringify(log);
            const message = Buffer.from(logStr);
            
            this.client.send(message, this.port, this.host, (err) => {
                if (err) {
                    console.error(`Erro ao enviar log para Graylog: ${err.message}`);
                    this.connected = false;
                    this.scheduleReconnect();
                }
            });
        } catch (error) {
            console.error(`Erro ao formatar/enviar log: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    close() {
        if (this.reconnectTimeout) {
            clearTimeout(this.reconnectTimeout);
        }
        
        if (this.client) {
            try {
                this.client.close();
            } catch (e) {
                // Ignorar erros no fechamento
            }
        }
    }
}

// Configurar o transporte para Graylog se habilitado
let graylogTransport: GraylogTransport | null = null;

if (graylogConfig.enabled) {
    const port = parseInt(String(graylogConfig.port), 10);
    if (!isNaN(port) && graylogConfig.host) {
        graylogTransport = new GraylogTransport(graylogConfig.host, port);
        console.log(`Transporte UDP para Graylog configurado em ${graylogConfig.host}:${port}`);
    }
}

// Instância do logger
const logger = pino({
    level: getValue('graylogLogLevel') || 'info',
    transport: {
        target: 'pino-pretty',
        options: { colorize: true }
    }
});

// Função principal para padronizar logs
function formatLog(message: any, level = LOG_LEVELS.info): StandardLogFormat {
    const timestamp = Date.now() / 1000;
    const correlationId = uuidv4();
    
    // String simples
    if (typeof message === 'string') {
        return {
            ...defaultLogValues,
            short_message: message,
            timestamp,
            level,
            _correlation_id: correlationId
        };
    }
    
    // Objeto de erro
    if (message instanceof Error) {
        return {
            ...defaultLogValues,
            short_message: message.message,
            full_message: message.stack,
            timestamp,
            level: LOG_LEVELS.error,
            _error_message: message.message,
            _error_code: message.name,
            _correlation_id: correlationId
        };
    }
    
    // Objeto com dados personalizados
    const shortMessage = message.msg || message.message || message.short_message || "No Content";
    const fullMessage = message.fullMessage || message.full_message || message.details;
    
    // Remove propriedades duplicadas
    const { msg, message: msgProp, short_message, full_message, ...rest } = message;
    
    // Monta o log padronizado
    const standardLog: StandardLogFormat = {
        ...defaultLogValues,
        short_message: shortMessage,
        timestamp,
        level,
        _correlation_id: message._correlation_id || correlationId,
        ...rest
    };
    
    if (fullMessage) standardLog.full_message = fullMessage;
    
    return standardLog;
}

// Função para enviar log diretamente para o Graylog via UDP
function sendToGraylog(log: StandardLogFormat) {
    if (graylogTransport && graylogConfig.enabled) {
        graylogTransport.write(log, () => {});
    }
}

// Enviar teste UDP para Graylog
async function testGraylogConnection(): Promise<{success: boolean, message: string}> {
    if (!graylogConfig.enabled) {
        return { 
            success: false, 
            message: "Graylog não está ativado nas configurações." 
        };
    }

    const testId = `test-${Date.now()}`;
    const port = parseInt(String(graylogConfig.port), 10);
    
    if (isNaN(port)) {
        return { 
            success: false, 
            message: `Porta inválida: ${graylogConfig.port}` 
        };
    }
    
    try {
        // Criar mensagem de teste
        const testLog = formatLog({
            short_message: `Teste de conexão [${testId}]`,
            _test_id: testId,
            _tags: ["test"]
        });
        
        // Enviar usando nosso transport
        if (graylogTransport) {
            graylogTransport.write(testLog, () => {});
            
            return {
                success: true,
                message: `Conexão com Graylog estabelecida. Teste enviado com ID: ${testId}`
            };
        }
        
        // Fallback para envio direto caso o transporte não esteja inicializado
        const result = await new Promise<boolean>(resolve => {
            const client = dgram.createSocket('udp4');
            const message = Buffer.from(JSON.stringify(testLog));
            let success = false;
            
            client.on('error', () => {
                client.close();
                resolve(false);
            });
            
            client.send(message, port, graylogConfig.host as string, (err) => {
                if (!err) success = true;
                
                // UDP não tem confirmação, então esperamos um pouco
                setTimeout(() => {
                    client.close();
                    resolve(success);
                }, 1000);
            });
        });
        
        return {
            success: result,
            message: result 
                ? `Conexão com Graylog estabelecida. Teste enviado com ID: ${testId}` 
                : "Falha ao enviar mensagem para Graylog."
        };
    } catch (error) {
        return {
            success: false,
            message: `Erro na conexão com Graylog: ${error instanceof Error ? error.message : String(error)}`
        };
    }
}

// Logger seguro com formatação padronizada
const safeLogger = {
    info: (message: any, ...args: any[]) => {
        try {
            // Verifica se deve logar este nível
            if (!shouldLog(LOG_LEVELS.info)) return;
            
            const formattedLog = formatLog(message, LOG_LEVELS.info);
            logger.info(formattedLog, ...args);
            sendToGraylog(formattedLog);
        } catch (err) {
            console.info('[FALLBACK]', message, ...args);
        }
    },
    error: (message: any, ...args: any[]) => {
        try {
            // Verifica se deve logar este nível
            if (!shouldLog(LOG_LEVELS.error)) return;
            
            const formattedLog = formatLog(message, LOG_LEVELS.error);
            logger.error(formattedLog, ...args);
            sendToGraylog(formattedLog);
        } catch (err) {
            console.error('[FALLBACK]', message, ...args);
        }
    },
    warn: (message: any, ...args: any[]) => {
        try {
            // Verifica se deve logar este nível
            if (!shouldLog(LOG_LEVELS.warn)) return;
            
            const formattedLog = formatLog(message, LOG_LEVELS.warn);
            logger.warn(formattedLog, ...args);
            sendToGraylog(formattedLog);
        } catch (err) {
            console.warn('[FALLBACK]', message, ...args);
        }
    },
    debug: (message: any, ...args: any[]) => {
        try {
            // Verifica se deve logar este nível
            if (!shouldLog(LOG_LEVELS.debug)) return;
            
            const formattedLog = formatLog(message, LOG_LEVELS.debug);
            logger.debug(formattedLog, ...args);
            sendToGraylog(formattedLog);
        } catch (err) {
            console.debug('[FALLBACK]', message, ...args);
        }
    },
    
    // Criar contexto de logging para reutilizar campos comuns
    createContext: (contextData: Partial<StandardLogFormat>) => {
        const contextValues = { ...contextData };
        
        return {
            info: (message: any, ...args: any[]) => {
                try {
                    // Verifica se deve logar este nível
                    if (!shouldLog(LOG_LEVELS.info)) return;
                    
                    const baseLog = formatLog(message, LOG_LEVELS.info);
                    const contextualLog = { ...baseLog, ...contextValues };
                    logger.info(contextualLog, ...args);
                    sendToGraylog(contextualLog);
                } catch (err) {
                    console.info('[FALLBACK]', message, ...args);
                }
            },
            error: (message: any, ...args: any[]) => {
                try {
                    // Verifica se deve logar este nível
                    if (!shouldLog(LOG_LEVELS.error)) return;
                    
                    const baseLog = formatLog(message, LOG_LEVELS.error);
                    const contextualLog = { ...baseLog, ...contextValues };
                    logger.error(contextualLog, ...args);
                    sendToGraylog(contextualLog);
                } catch (err) {
                    console.error('[FALLBACK]', message, ...args);
                }
            },
            warn: (message: any, ...args: any[]) => {
                try {
                    // Verifica se deve logar este nível
                    if (!shouldLog(LOG_LEVELS.warn)) return;
                    
                    const baseLog = formatLog(message, LOG_LEVELS.warn);
                    const contextualLog = { ...baseLog, ...contextValues };
                    logger.warn(contextualLog, ...args);
                    sendToGraylog(contextualLog);
                } catch (err) {
                    console.warn('[FALLBACK]', message, ...args);
                }
            },
            debug: (message: any, ...args: any[]) => {
                try {
                    // Verifica se deve logar este nível
                    if (!shouldLog(LOG_LEVELS.debug)) return;
                    
                    const baseLog = formatLog(message, LOG_LEVELS.debug);
                    const contextualLog = { ...baseLog, ...contextValues };
                    logger.debug(contextualLog, ...args);
                    sendToGraylog(contextualLog);
                } catch (err) {
                    console.debug('[FALLBACK]', message, ...args);
                }
            }
        };
    },
    
    // Funções para diagnóstico - Renomeada para manter compatibilidade
    testGraylogConnection: testGraylogConnection,  // Manter o nome antigo para compatibilidade
    testConnection: testGraylogConnection,         // Novo nome mais consistente
    isEnabled: () => graylogConfig.enabled,
    getConfig: () => ({ ...graylogConfig }),
    formatLog,  // Exporta para uso em testes ou casos especiais
    
    // Método para fechar conexões no encerramento
    close: () => {
        if (graylogTransport) {
            graylogTransport.close();
        }
    },
    
    // Configuração adicional para uso como pacote
    configure: (config: any) => {
        // Esta função será definida no index.ts
    }
};

// Log inicial se o Graylog estiver configurado
if (graylogConfig.enabled) {
    console.log(`Graylog configurado em ${graylogConfig.host}:${graylogConfig.port}`);
    safeLogger.info({
        short_message: "Configuração do Graylog carregada",
        host: graylogConfig.host,
        port: graylogConfig.port
    });
}

export { safeLogger };