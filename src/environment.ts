import dotenv from "dotenv";
dotenv.config({ path: process.env.ENV_FILE_PATH || ".env.development" });

interface Environment {
  graylogApplicationName: string;  
  graylogEnvironment: string;
  graylogHost: string;
  graylogProduct: string;
  graylogPort: number;
  graylogEnabled: string;
  graylogLogLevel?: 'fatal' | 'error' | 'warn' | 'info' | 'debug';
}

const getEnvironmentVariable = (environmentVariableName: string) => {
  const environmentVariable = process.env[environmentVariableName];
  if (!environmentVariable) return "";
  return environmentVariable;
};

export const environment: Environment = {
  graylogApplicationName: getEnvironmentVariable("GRAYLOG_APPLICATION_NAME"),  
  graylogEnvironment: getEnvironmentVariable("GRAYLOG_ENVIRONMENT"),
  graylogHost: getEnvironmentVariable("GRAYLOG_HOST"),
  graylogProduct: getEnvironmentVariable("GRAYLOG_PRODUCT"),
  graylogPort: Number(getEnvironmentVariable("GRAYLOG_PORT")),
  graylogEnabled: getEnvironmentVariable("GRAYLOG_ENABLED"),
  graylogLogLevel: getEnvironmentVariable("GRAYLOG_LOG_LEVEL") as 'fatal' | 'error' | 'warn' | 'info' | 'debug'

};

export const getValue = (key: keyof Environment): any => {
  return environment[key];
};
