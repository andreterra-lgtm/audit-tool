# Ferramenta de Auditoria - Frutos de Goiás

Esta é uma ferramenta profissional para auditoria de unidades, com cálculo de nota ponderada e salvamento em banco de dados.

## 🚀 Como Iniciar

1. **Requisitos**: Tenha o [Node.js](https://nodejs.org/) instalado.
2. **Iniciar o Servidor**:
   - Abra o terminal na pasta `audit-tool`.
   - Execute o comando: `node server.js`
3. **Acessar a Ferramenta**:
   - Abra o navegador e acesse: `http://localhost:3000`
   - O site é **responsivo**, então você pode acessar do seu celular se estiver na mesma rede Wi-Fi (usando o IP do seu computador).

## 📊 Como Ver os Dados Salvos

Existem duas formas simples de obter os dados preenchidos:

1. **Pela Interface do Site**:
   - Na barra inferior (no celular) ou no menu, clique em **Histórico**.
   - Você verá uma tabela com todas as auditorias realizadas, nomes das unidades, consultores e a nota final obtida.
2. **Pelo Banco de Dados (Avançado)**:
   - Todas as respostas estão salvas no arquivo `audit.db` dentro desta pasta.
   - Você pode abrir este arquivo com o programa [DB Browser for SQLite](https://sqlitebrowser.org/) para exportar para Excel ou analisar os dados brutos.

## ⚖️ Lógica de Cálculo
A nota é calculada automaticamente seguindo os pesos oficiais:
- **Execução**: 50%
- **Performance**: 35%
- **Gestão**: 15%
- Dentro de cada bloco, as questões têm peso igual, conforme as instruções do programa.
