# Busca e Entrega — Pet Shop (Motorista)

Painel do **motorista** do pet shop: mostra a agenda de **buscas e entregas** do dia, organiza a rota e permite atualizar o status de cada serviço.

> **Importante:** este projeto é apenas a tela do **motorista**. O cadastro das buscas/entregas é feito no **painel ADM** ([`adm-petshop`](../adm-petshop), aba **Busca e Entrega**). Os dois se conectam ao **mesmo projeto Firebase (Firestore)** e à **mesma coleção `busca_entrega`**. O **site de agendamento** do pet shop é outro projeto ([`site-petshop-vt`](../site-petshop-vt)) e usa o mesmo projeto Firebase.

```
 ADM (adm-petshop)  ──cria/edita──►  Firestore: busca_entrega  ◄──lê/atualiza status──  Motorista (este)
 aba Busca e Entrega                 projeto operacao50k                               buscaentrega-petshop
```

## Funcionalidades

- Agenda do motorista com as buscas e entregas do dia
- Filtro por **data** e por **status**
- Resumo (pendentes de busca, no local, entregues)
- Lista de rotas ordenada (campo `ordemRota`)
- Atualização de status direto pelo motorista: **Busca → No local → Saiu para entrega → Entregue**
- Edição de dados da rota (`updateRoute`) com `updatedAt` automático

## Tecnologias

- HTML, CSS e JavaScript puro (ES Modules), **sem build e sem `npm install`**
- Firebase **Firestore** (SDK 10.12.2 via CDN `gstatic`)
- Boxicons e fonte Poppins via CDN

## Estrutura

| Arquivo | Função |
|---|---|
| `index.html` | Layout da tela do motorista |
| `motorista.js` | Lógica + **`firebaseConfig`** + leitura/atualização no Firestore |
| `style.css` | Estilos |

## Como sincronizar com o Firebase

Os projetos só conversam se usarem **o mesmo `firebaseConfig`** (mesmo `projectId`).

### 1. Configurar este projeto
O `firebaseConfig` em `motorista.js` está com **campos vazios** (placeholders). Cole o mesmo objeto usado pelo ADM do pet shop (`adm-petshop/firebase.js`, projeto **`operacao50k`**):

```js
const firebaseConfig = {
  apiKey: "...",
  authDomain: "operacao50k.firebaseapp.com",
  projectId: "operacao50k",
  storageBucket: "...",
  messagingSenderId: "...",
  appId: "..."
};
```

Para obter os valores: [Firebase Console](https://console.firebase.google.com/) → *Project settings → Your apps → Web*. Ative o **Firestore Database**.

### 2. Fluxo de dados
- **ADM grava** as buscas/entregas na coleção `busca_entrega` → **motorista lê** na agenda
- **Motorista atualiza** `status` (e demais campos da rota) → **ADM vê** a mudança na aba Busca e Entrega

### 3. Coleção `busca_entrega`

| Campo | Descrição |
|---|---|
| `nome` | Nome do cliente/pet |
| `endereco` | Endereço da busca/entrega |
| `contato` / `contatoFormatado` | Telefone |
| `dataBusca` / `horaBusca` | Data (`AAAA-MM-DD`) e hora da busca |
| `dataEntrega` / `horaEntrega` | Data e hora da entrega |
| `status` | `busca`, `no-local`, `saiu-para-entrega` ou `entregue` |
| `obs` | Observações |
| `motoristaId` | Motorista responsável (opcional) |
| `ordemRota` | Ordem na rota |
| `origemCadastro` | Origem do cadastro (padrão `admin`) |
| `createdAt` / `updatedAt` | Controle de datas |

O motorista consulta com `where("dataBusca", "==", data)` e `where("status", "==", status)`; ao filtrar os dois ao mesmo tempo, o Firestore pode pedir um **índice composto** (o erro no console traz o link para criá-lo).

### 4. Regras do Firestore
Esta tela **não usa login**, então as regras precisam permitir ler e atualizar `busca_entrega` sem autenticação.

> ⚠️ O `firebaseConfig` é público no navegador. Quem o conhecer poderá ler/alterar `busca_entrega` (nomes, endereços e telefones de clientes). Restrinja o quanto possível (ex.: validar apenas atualização dos campos `status`, `obs`, `ordemRota` e `updatedAt`) ou adicione Firebase Authentication para o motorista.

## Como executar

Por usar ES Modules, abra por um servidor local (não por `file://`):

```bash
npx serve .
# ou
python -m http.server 5500
```

Ou use a extensão **Live Server** do VS Code. Para publicar: Vercel, Netlify, Firebase Hosting (o ADM referencia `https://buscaentrega-petshop.vercel.app/`).

## Checklist de integração

- [ ] Firestore ativado no projeto `operacao50k`
- [ ] `firebaseConfig` de `motorista.js` **idêntico** ao do `adm-petshop`
- [ ] Regras permitem ler e atualizar `busca_entrega`
- [ ] Criar uma busca na aba **Busca e Entrega** do ADM e conferir que aparece na agenda do motorista
- [ ] Mudar o status pelo motorista e conferir no ADM
