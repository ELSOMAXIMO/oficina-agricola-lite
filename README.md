<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/20cb086a-fc3e-4ea5-80e7-ede3ee9f858e

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`

## Android Studio / APK

O projeto foi preparado com Capacitor e a pasta Android já foi gerada em [android](android).

### Pré-requisito importante

Os recursos de Google Login, Gmail e Google Drive dependem do backend em `server.ts`. Dentro do APK, esses endpoints não existem localmente, então o build Android precisa apontar para um backend HTTPS publicado.

Crie um arquivo `.env.production.local` com:

```env
VITE_API_BASE_URL=https://api.seudominio.com.br
```

Se quiser, use [.env.android.example](.env.android.example) como referência.

### JDK no Android Studio

Use JDK 21 no Gradle do Android Studio. O build local desta máquina falhou com `Unsupported class file major version 69`, indicando Java novo demais para a combinação atual de Gradle/Android plugin gerada pelo Capacitor.

No Android Studio, configure:

1. `File` > `Settings`
2. `Build, Execution, Deployment` > `Build Tools` > `Gradle`
3. `Gradle JDK` = `JDK 21`

### Gerar o projeto Android atualizado

```bash
npm install
npm run build:android
```

### Abrir no Android Studio

```bash
npm run android:open
```

Ou abra manualmente a pasta [android](android) no Android Studio.

### Gerar o APK

No Android Studio:

1. Aguarde o Gradle sincronizar.
2. Abra `Build`.
3. Clique em `Build Bundle(s) / APK(s)`.
4. Clique em `Build APK(s)`.

O APK será gerado em um caminho semelhante a:

`android/app/build/outputs/apk/debug/app-debug.apk`

### Sempre que alterar o app web

Depois de qualquer mudança no React/Vite, rode novamente:

```bash
npm run build:android
```

## Publicar o backend para o APK

O APK precisa de um backend HTTPS publicado para Google Login, Gmail e Google Drive. O backend deste projeto está em [server.ts](server.ts).

Para o passo a passo completo de Render + Google Cloud, veja [DEPLOY_RENDER_GOOGLE.md](DEPLOY_RENDER_GOOGLE.md).

### Deploy rápido no Render

Este repositório já inclui [render.yaml](render.yaml) para facilitar o deploy.

1. Publique o projeto no GitHub.
2. No Render, crie um novo `Blueprint` apontando para o repositório.
3. Configure as variáveis de ambiente:

```env
APP_URL=https://SEU-SERVICO.onrender.com
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GOOGLE_REDIRECT_URI=https://SEU-SERVICO.onrender.com/auth/google/callback
DRIVE_BACKUP_KEEP_LATEST=3
DRIVE_BACKUP_FOLDER_NAME=Oficina Agricola Lite Backups
```

4. No Google Cloud Console, adicione a URI autorizada de redirecionamento:

```text
https://SEU-SERVICO.onrender.com/auth/google/callback
```

5. Depois do deploy, teste:

```text
https://SEU-SERVICO.onrender.com/api/health
```

Se responder JSON com `status: ok`, use essa base no APK em `Configurações > Integrações`.

Exemplo:

```text
https://SEU-SERVICO.onrender.com
```
