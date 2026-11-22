# Diário Nutri

PWA estático em português para registrar alimentos e acompanhar as calorias registradas por dia. Sem login, servidor de dados, publicidade ou bibliotecas externas.

## Uso

- Escolha a data e adicione um alimento por refeição. Use o peso da parte comestível, conforme o preparo indicado, ou informe diretamente as kcal da porção pelo rótulo.
- O histórico mostra os totais das datas registradas. As calorias são estimativas e o aplicativo não define metas de alimentação.
- Os registros ficam neste navegador/aparelho, sem sincronização. Use **Dados** para exportar um backup JSON e guarde-o em local privado. Não versione backups neste repositório.
- Em uma hospedagem HTTPS, abra o endereço no Safari do iPhone, toque em **Compartilhar → Adicionar à Tela de Início**. Após a primeira abertura online, o app pode carregar offline.

## Desenvolvimento

Não há etapa de build nem dependências. Na pasta do projeto, execute `python3 -m http.server 8000` e abra `http://localhost:8000/`. Para publicar em repositório com hospedagem estática habilitada, use a pasta raiz. Atualize a versão do cache em `sw.js` ao alterar o app.

## Referência de alimentos

Valores estimados em kcal por 100 g de parte comestível: [Tabela Brasileira de Composição de Alimentos (TACO), 4ª edição, NEPA/UNICAMP, 2011](https://nepa.unicamp.br/wp-content/uploads/sites/27/2023/10/taco_4_edicao_ampliada_e_revisada.pdf), tabela 1. Para alimentos de marca e receitas cuja composição é diferente, use o valor do rótulo ou da receita para a porção consumida.
