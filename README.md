# Oficina Agrícola Lite 🌾

Sistema de gerenciamento leve para oficinas de maquinário agrícola.  
100 % client-side — sem backend, sem dependências externas. Dados salvos no `localStorage` do navegador.

---

## Funcionalidades

| Módulo | Descrição |
|---|---|
| **Dashboard** | Visão geral: ordens abertas, clientes, equipamentos e estoque baixo |
| **Ordens de Serviço** | Criação, edição e acompanhamento de OS com status e datas |
| **Clientes** | Cadastro de produtores rurais com contato e localização |
| **Equipamentos** | Registro de tratores, colheitadeiras e demais máquinas agrícolas |
| **Peças / Estoque** | Controle de peças com alerta de estoque mínimo |

## Como usar

Abra o arquivo `index.html` diretamente no navegador — nenhuma instalação necessária.

```
open index.html
```

Ou sirva localmente:

```bash
npx serve .
# http://localhost:3000
```

## Estrutura do projeto

```
oficina-agricola-lite/
├── index.html          # Página principal (SPA)
├── css/
│   └── style.css       # Estilos
├── js/
│   ├── storage.js      # Camada de persistência (localStorage)
│   ├── utils.js        # Helpers de UI (modal, toast, formatação)
│   ├── clientes.js     # Módulo Clientes
│   ├── equipamentos.js # Módulo Equipamentos
│   ├── pecas.js        # Módulo Peças / Estoque
│   ├── ordens.js       # Módulo Ordens de Serviço
│   ├── dashboard.js    # Módulo Dashboard
│   └── app.js          # Inicialização e roteamento
└── README.md
```

## Tecnologias

- HTML5 / CSS3 / JavaScript (ES5 compatível)
- Sem frameworks externos
- `localStorage` para persistência de dados

## Licença

MIT
