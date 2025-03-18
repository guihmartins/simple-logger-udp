# Instale as dependências (se você escolheu a opção 3)
npm install

# Incrementa a versão patch (1.0.0 -> 1.0.1)
npm version patch

# OU incrementa a versão minor (1.0.0 -> 1.1.0)
npm version minor

# OU incrementa a versão major (1.0.0 -> 2.0.0)
npm version major

# Crie um pacote tarball
npm pack

# Isso gerará um arquivo como simple-logger-udp-1.0.0.tgz

Você pode instalar esse pacote em outro projeto para testes:
npm install /caminho/para/simple-logger-udp-1.0.0.tgz


# Publique o pacote
npm run publish-package
# Ou, se você removeu o script publish personalizado:
npm publish