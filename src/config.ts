/**
 * Interface para configuração do logger
 */
export interface LoggerConfig {
  graylogHost: string;
  graylogPort: number;
  graylogProduct: string;
  graylogApplicationName: string;
  graylogEnvironment: string;
  graylogEnabled: boolean;
  logLevel?: 'fatal' | 'error' | 'warn' | 'info' | 'debug';
}

/**
 * Configuração padrão do logger
 */
export const defaultConfig: LoggerConfig = {
  graylogHost: 'localhost',
  graylogPort: 12201,
  graylogProduct: 'default-product',
  graylogApplicationName: 'default-app',
  graylogEnvironment: 'development',
  graylogEnabled: false,
  logLevel: 'info'
};

let currentConfig: LoggerConfig = { ...defaultConfig };

/**
 * Configura o logger
 * @param config Configuração personalizada do logger
 */
export function configureLogger(config: Partial<LoggerConfig>): void {
  currentConfig = { ...defaultConfig, ...config };
}

/**
 * Obtém um valor de configuração
 * @param key Nome da configuração
 * @returns Valor da configuração
 */
export function getValue<K extends keyof LoggerConfig>(key: K): LoggerConfig[K] {
  return currentConfig[key];
}

/**
 * Obtém a configuração atual
 */
export function getConfig(): LoggerConfig {
  return { ...currentConfig };
}
