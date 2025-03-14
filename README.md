# Simple Logger UDP

Um logger TypeScript simples com suporte para envio de logs via UDP para Graylog.

## Instalação

```bash
npm install simple-logger-udp
```

## Uso básico

```typescript
import logger from 'simple-logger-udp';

// Configura o logger (opcional)
logger.configure({
  graylogHost: 'seu-servidor-graylog.com',
  graylogPort: 12201,
  graylogProduct: 'seu-produto',
  graylogApplicationName: 'sua-aplicacao',
  graylogEnvironment: 'production',
  graylogEnabled: true,
  logLevel: 'info'
});

// Uso básico
logger.info('Mensagem de informação');
logger.error('Ocorreu um erro');
logger.warn('Aviso importante');
logger.debug('Informação de debug');

// Usando objetos
logger.info({
  short_message: 'Evento de login',
  user_id: 123,
  ip: '192.168.0.1'
});

// Contexto de logging
const reqLogger = logger.createContext({
  request_id: '1234-5678',
  user_id: 'user-123'
});

reqLogger.info('Processando requisição...');
reqLogger.error(new Error('Falha ao processar'));

// Teste de conexão com Graylog
const testResult = await logger.testConnection();
console.log(testResult);

// Fechando o logger ao encerrar a aplicação
process.on('SIGTERM', () => {
  logger.close();
});
```

## APIs

### Métodos principais
- `info(message)` - Registra uma mensagem de nível informativo
- `error(message)` - Registra uma mensagem de nível de erro
- `warn(message)` - Registra uma mensagem de nível de aviso
- `debug(message)` - Registra uma mensagem de nível de depuração

### Configuração
- `configure(config)` - Define as configurações do logger

### Utilitários
- `createContext(contextData)` - Cria um contexto de logger com dados predefinidos
- `testConnection()` - Testa a conexão com o servidor Graylog
- `isEnabled()` - Verifica se o envio para Graylog está ativado
- `close()` - Fecha as conexões UDP

## Licença

MIT
