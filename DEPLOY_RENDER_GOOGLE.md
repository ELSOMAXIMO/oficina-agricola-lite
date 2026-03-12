# Deploy do Backend Para o APK

Este projeto precisa de um backend HTTPS publicado para que o APK consiga usar:

- Google Login
- envio de orçamentos por Gmail
- backups automáticos no Google Drive

O backend está em [server.ts](server.ts).

## 1. Publicar no GitHub

Publique este projeto em um repositório GitHub.

O Render vai usar esse repositório para criar o serviço.

## 2. Criar o serviço no Render

Este projeto já contém [render.yaml](render.yaml).

No Render:

1. Entre em `Dashboard`.
2. Clique em `New`.
3. Clique em `Blueprint`.
4. Conecte o repositório GitHub deste projeto.
5. Confirme a criação do serviço.

Nome esperado do serviço:

`oficina-agricola-lite-api`

Depois do deploy, o Render vai gerar uma URL parecida com:

`https://oficina-agricola-lite-api.onrender.com`

Essa será a base para o APK.

## 3. Variáveis do Render

No serviço criado no Render, configure estas variáveis de ambiente:

`NODE_ENV=production`

`APP_URL=https://SEU-SERVICO.onrender.com`

`GOOGLE_CLIENT_ID=COLE_AQUI_O_CLIENT_ID`

`GOOGLE_CLIENT_SECRET=COLE_AQUI_O_CLIENT_SECRET`

`GOOGLE_REDIRECT_URI=https://SEU-SERVICO.onrender.com/auth/google/callback`

`DRIVE_BACKUP_KEEP_LATEST=3`

`DRIVE_BACKUP_FOLDER_NAME=Oficina Agricola Lite Backups`

Substitua `SEU-SERVICO.onrender.com` pelo domínio real que o Render gerar.

Exemplo:

`APP_URL=https://oficina-agricola-lite-api.onrender.com`

`GOOGLE_REDIRECT_URI=https://oficina-agricola-lite-api.onrender.com/auth/google/callback`

## 4. Criar as credenciais no Google Cloud

No Google Cloud Console:

1. Abra `APIs e serviços`.
2. Vá em `Tela de consentimento OAuth`.
3. Configure o app como externo ou interno, conforme sua conta Google Workspace.
4. Adicione os escopos usados pelo projeto:

`https://www.googleapis.com/auth/gmail.send`

`https://www.googleapis.com/auth/drive.file`

`https://www.googleapis.com/auth/userinfo.profile`

`https://www.googleapis.com/auth/userinfo.email`

5. Vá em `Credenciais`.
6. Crie um `ID do cliente OAuth 2.0` do tipo `Aplicativo da Web`.

Preencha assim:

Nome:

`Oficina Agricola Lite Backend`

URIs de redirecionamento autorizados:

`https://SEU-SERVICO.onrender.com/auth/google/callback`

Se você também usa localmente no PC para testes, adicione também:

`http://localhost:3000/auth/google/callback`

Origens JavaScript autorizadas recomendadas:

`https://SEU-SERVICO.onrender.com`

`http://localhost:3000`

Depois disso, copie:

- Client ID
- Client Secret

E preencha no Render como:

- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`

## 5. Habilitar APIs do Google

No mesmo projeto do Google Cloud, habilite:

- Gmail API
- Google Drive API

Sem isso, o login pode até funcionar, mas envio de email e backup no Drive falham.

## 6. Confirmar que o backend subiu

Depois do deploy, teste no navegador:

`https://SEU-SERVICO.onrender.com/api/health`

Resultado esperado:

```json
{"status":"ok","timestamp":"2026-03-11T00:00:00.000Z"}
```

Também vale testar:

`https://SEU-SERVICO.onrender.com/api/google/config`

Resultado esperado:

- `configured: true`
- `redirectUri` apontando para `/auth/google/callback`

## 7. URL que entra no APK

No APK, em `Configurações > Integrações`, informe apenas a base:

`https://SEU-SERVICO.onrender.com`

Não inclua:

- `/api`
- `/auth/google/callback`
- caminhos extras

Exemplo correto:

`https://oficina-agricola-lite-api.onrender.com`

Exemplo incorreto:

`https://oficina-agricola-lite-api.onrender.com/api`

## 8. Se funcionar no PC e não no APK

As causas mais comuns são:

1. O campo do backend no APK está vazio.
2. A URL foi salva com caminho extra, como `/api`.
3. O serviço no Render ainda está dormindo ou falhou no deploy.
4. `GOOGLE_REDIRECT_URI` não bate exatamente com a URI cadastrada no Google Cloud.
5. Gmail API ou Drive API não foram habilitadas.
6. O callback foi criado para localhost, mas não para o domínio do Render.

## 9. Valor final esperado

Se o Render gerar este domínio:

`https://oficina-agricola-lite-api.onrender.com`

Então use exatamente:

- Render `APP_URL`
  `https://oficina-agricola-lite-api.onrender.com`
- Render `GOOGLE_REDIRECT_URI`
  `https://oficina-agricola-lite-api.onrender.com/auth/google/callback`
- APK `Configurações > Integrações`
  `https://oficina-agricola-lite-api.onrender.com`