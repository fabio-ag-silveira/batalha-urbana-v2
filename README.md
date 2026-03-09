# Batalha Urbana

Migracao do projeto original em C++ para uma versao web moderna com `HTML + CSS + JavaScript modular`.

## Como executar

No terminal, dentro de `c:\repos\batalha-urbana`, execute:

```powershell
python -m http.server 8000
```

Depois abra:

`http://127.0.0.1:8000`

Esse comando sobe um servidor web estatico local na porta `8000`. Ele e recomendado em vez de abrir o [index.html](/c:/repos/batalha-urbana/index.html) diretamente porque:

- carrega os modulos JavaScript (`import/export`) em um ambiente web normal
- evita problemas de caminho relativo e politicas do navegador ao abrir arquivos pelo disco
- reproduz melhor o comportamento real da aplicacao

Para parar o servidor, use `Ctrl + C` no terminal.

## Modo LAN

Para o modo LAN com salas automaticas no mesmo servidor, use:

```powershell
node server.js
```

Depois:

1. O host abre `http://127.0.0.1:8000`, entra em `LAN` e clica em `Criar sala`.
2. O amigo abre o endereco do host no navegador.

Com Hamachi ou Radmin, o amigo deve abrir:

`http://IP_DO_HOST_NA_REDE_VIRTUAL:8000`

3. Na tela `LAN`, as salas abertas aparecem automaticamente na lista.
4. O amigo clica na sala disponivel para entrar.
5. Cada navegador assume automaticamente `Player 1` ou `Player 2`.

Observacoes:

- Nao e necessario preencher porta ou codigo manualmente para entrar, desde que ambos estejam acessando o mesmo servidor.
- O campo `Servidor` so precisa ser alterado se voce abrir a interface a partir de outro endereco e quiser consultar um host diferente.
- O modo LAN atual funciona bem para rede local, Hamachi e Radmin porque ambos acessam o mesmo servidor HTTP do host.

## Estrutura

- [src/game.js](/c:/repos/batalha-urbana/src/game.js): estado da partida, turnos, tiros, pontos e colisao.
- [src/scene.js](/c:/repos/batalha-urbana/src/scene.js): desenho do cenario, carrinhos e trajetorias.
- [src/renderer.js](/c:/repos/batalha-urbana/src/renderer.js): renderer Canvas e conversao de coordenadas.
- [src/config.js](/c:/repos/batalha-urbana/src/config.js): constantes, spawns e caixas de colisao.
- [src/math.js](/c:/repos/batalha-urbana/src/math.js): transformacoes geometricas reutilizaveis.

## Regra importante da migracao

O jogo continua trabalhando em `coordenadas de gameplay` derivadas do legado. O renderer aplica depois a transformacao de camera equivalente ao OpenGL antigo:

- `xTela = xGameplay * 0.2`
- `yTela = (yGameplay - 115) * 0.3`
- viewport ortografica fixa em `[-40, 40]`

Isso isola a logica do jogo do desenho e evita que otimizacoes mudem a posicao de objetos.

## Legado

Repositorio original em C++/OpenGL: <https://github.com/fabio-ag-silveira/BatalhaUrbana_C17>
