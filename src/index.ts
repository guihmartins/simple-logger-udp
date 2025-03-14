import { safeLogger } from './logger';
import { configureLogger, LoggerConfig } from './config';
import { StandardLogFormat } from './logger';

// Adiciona a função de configuração
safeLogger.configure = (config: Partial<LoggerConfig>) => {
  configureLogger(config);
};

export default safeLogger;
export { StandardLogFormat, LoggerConfig };
