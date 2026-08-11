# MVP de venda e demonstracao do BarberOS

Este documento existe para validar o BarberOS com barbearias reais antes de investir em automacoes grandes, gateway de pagamento, app nativo ou CRM avancado.

## Objetivo do MVP

Validar com 3 barbearias piloto se o BarberOS resolve uma dor real o bastante para alguem pagar.

O objetivo nao e ter todos os recursos do mercado. O objetivo e provar estes pontos:

- A barbearia entende o valor em menos de 10 minutos.
- O dono consegue configurar perfil, servicos, barbeiros e agenda sem ajuda tecnica pesada.
- Pelo menos 1 agendamento real entra pelo link publico.
- Pelo menos 5 clientes reais entram na base.
- O dono aceita pagar depois do teste.

## Cliente ideal inicial

Priorize barbearias pequenas ou medias com:

- 1 a 5 barbeiros.
- Agendamento feito por WhatsApp.
- Perda de horario por esquecimento, demora para responder ou agenda baguncada.
- Dono que ainda participa da operacao.
- Nenhum sistema, planilha improvisada ou sistema que a equipe nao usa direito.

Evite no primeiro ciclo:

- Redes grandes com varias unidades.
- Barbearias que exigem pagamento online desde o primeiro dia.
- Operacoes que precisam de permissao complexa por cargo.
- Clientes que querem aplicativo nativo antes de testar o link publico.

## Oferta piloto

Use uma oferta simples:

"Eu estou validando o BarberOS com poucas barbearias. Eu configuro com voce, libero 30 dias de uso e acompanho os primeiros agendamentos. Se fizer sentido depois do teste, voce continua em um plano mensal."

Hipotese de preco para testar:

- Starter: R$49/mes para uma barbearia pequena.
- Studio: R$89/mes para equipe com mais de um barbeiro.
- Pro: R$149/mes quando houver recursos avancados, automacao ou suporte maior.

Nao implemente cobranca automatica antes de alguem topar pagar manualmente. Primeiro prove disposicao de pagamento.

## Roteiro de demo de 10 minutos

1. Abra a landing page e explique em uma frase: "O BarberOS organiza agenda, clientes, equipe e link publico de agendamento para barbearias que hoje dependem do WhatsApp."
2. Entre no app e mostre o Dashboard.
3. Mostre o checklist de ativacao: perfil, horarios, servicos, barbeiros, cliente e primeiro agendamento.
4. Configure ou revise o perfil publico da barbearia.
5. Cadastre um servico real, como "Corte" ou "Corte e barba".
6. Cadastre um barbeiro real.
7. Cadastre um cliente recebido pelo balcao ou WhatsApp.
8. Crie um agendamento interno na agenda.
9. Abra o link publico e simule um cliente pedindo horario.
10. Volte para a agenda e mostre o fluxo de confirmacao pelo WhatsApp.
11. Mostre rapidamente financeiro e base de clientes, sem vender como "ERP completo".

Frase de fechamento:

"O teste bom nao e olhar tela bonita. O teste bom e colocar seu link para alguns clientes e ver se menos conversa manual vira mais horario confirmado."

## Mensagem curta para abordar barbearias

Mensagem por WhatsApp:

"Oi, tudo bem? Estou criando o BarberOS, um sistema simples para barbearias organizarem agenda, clientes, barbeiros e agendamento online sem depender tanto de conversa manual no WhatsApp. Estou liberando 30 dias para poucas barbearias piloto e configuro junto com voce. Posso te mostrar em 10 minutos?"

Mensagem presencial:

"Vi que muita barbearia ainda perde tempo confirmando horario no WhatsApp. Estou testando um sistema que cria uma agenda online da barbearia, mas ainda deixa o contato pelo WhatsApp. Quero validar com poucas barbearias e acompanhar de perto. Posso te mostrar rapido?"

## Objecoes comuns

"Eu ja uso WhatsApp."

Resposta: "Perfeito. O BarberOS nao tenta tirar seu WhatsApp. Ele organiza antes: cliente escolhe servico, barbeiro, data e horario. Depois voce confirma pelo WhatsApp com contexto."

"Meus clientes nao vao agendar online."

Resposta: "Nao precisa migrar todo mundo. Vamos testar com alguns clientes que ja pedem horario por mensagem. Se eles aceitarem o link, ja reduz trabalho."

"Nao quero pagar sistema agora."

Resposta: "Sem problema. O piloto e para provar valor. Se em 30 dias nao ajudar sua rotina, voce nao continua."

"Nao tenho tempo para configurar."

Resposta: "Eu configuro junto com voce. Em poucos minutos colocamos servicos, barbeiros e horarios principais."

"E se der erro?"

Resposta: "Por isso o piloto e assistido. Eu acompanho os primeiros usos, e o WhatsApp continua como plano B."

"Tem app?"

Resposta: "Neste momento o foco e web responsivo e link publico. Isso reduz atrito porque o cliente nao precisa instalar nada."

## Checklist do piloto

Antes da demo:

- Criar conta de teste.
- Ter 3 servicos reais preparados.
- Ter 1 barbeiro real para cadastrar.
- Ter 1 cliente ficticio ou real para simular.
- Confirmar que `npm run check:release` passou antes de demonstrar uma versao nova.

Durante a demo:

- Mostrar primeiro valor de negocio, depois detalhes.
- Usar exemplos da barbearia, nao dados genericos.
- Fazer o dono copiar ou abrir o link publico.
- Pedir para ele imaginar o cliente real usando aquilo.

Depois da demo:

- Anotar se ele entendeu em menos de 10 minutos.
- Anotar onde ele travou.
- Pedir autorizacao para configurar a barbearia dele.
- Marcar retorno em 7 dias.
- Perguntar diretamente: "Se isso funcionar na sua rotina, voce pagaria quanto por mes?"

## Metricas de validacao

Use estas metricas para decidir se continua construindo:

- 3 barbearias aceitaram piloto.
- 2 barbearias configuraram perfil, horarios, servicos e barbeiros.
- 1 barbearia recebeu agendamento real pelo link publico.
- 1 dono disse claramente que pagaria.
- Pelo menos 5 clientes reais foram cadastrados em uma conta piloto.
- O dono usou agenda mais de uma vez na mesma semana.

## O que nao construir ainda

Segure estas ideias ate validar pagamento:

- Gateway de pagamento completo.
- Marketplace publico de barbearias.
- App nativo.
- Permissoes complexas por funcionario.
- Campanhas de marketing automatizadas.
- Integracao oficial WhatsApp Business API.
- Multiunidade.
- Relatorios avancados demais.

Esses recursos podem ser importantes depois. Agora eles podem atrasar a prova mais importante: alguem quer pagar pelo BarberOS?
