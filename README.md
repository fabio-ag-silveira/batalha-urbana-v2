# Batalha Urbana

Migracao do projeto original em C++ para uma versao web moderna com `HTML + CSS + JavaScript modular`.

## Como executar

No terminal, dentro de `c:eposatalha-urbana`, execute:

```powershell
node server.js
```

Depois abra `http://127.0.0.1:8000`. O mesmo servidor entrega o jogo e as salas do modo LAN. Para parar, use `Ctrl + C`.

## Como jogar

Cada jogador começa a rodada com 100 HP. Vence a rodada quem destruir o carrinho adversário, e a partida vai para quem vencer 3 rodadas.

| | Mira | Mover | Atirar |
|---|---|---|---|
| Player 1 | W/S | A/D | segure F e solte |
| Player 2 | I/K | J/L | segure H e solte |
| Jogador da vez (vs IA / LAN) | ↑/↓ | ←/→ | segure Espaço e solte |

- **Força:** segurar o disparo enche a barra em vai-e-vem; soltar atira. A marca branca mostra a força do tiro anterior.
- **Vento:** muda a cada turno e aparece no painel do topo (as nuvens também seguem o vento).
- **Explosões:** causam dano em área (acerto direto dá bônus), inclusive em quem atirou.
- **Cenário destrutível:** cada explosão abre uma cratera nos prédios. Carrinhos sem apoio caem, e quedas altas causam dano.
- **Movimento:** cada turno tem combustível limitado (barra amarela sob o HP).
- **Timer:** 20 s por turno. Se acabar durante a carga, o tiro sai com a força atual; senão, a vez passa.
- **Atalhos:** `B` reinicia, `M` alterna IA/local, `N` muda a dificuldade da IA, `U` liga/desliga o som.

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

- [src/game.js](/c:/repos/batalha-urbana/src/game.js): estado da partida, fases do turno, entrada, dano, quedas e IA. Não usa DOM, então roda também no `server.js`.
- [src/physics.js](/c:/repos/batalha-urbana/src/physics.js): trajetória com vento, colisão com prédios/crateras e apoio dos carrinhos.
- [src/scene.js](/c:/repos/batalha-urbana/src/scene.js): céu, cidade, carrinhos, projétil e painel do topo.
- [src/renderer.js](/c:/repos/batalha-urbana/src/renderer.js): renderer Canvas, conversão de coordenadas e camadas em cache.
- [src/effects.js](/c:/repos/batalha-urbana/src/effects.js): partículas, tremor de tela, textos de dano e banners (só no cliente).
- [src/audio.js](/c:/repos/batalha-urbana/src/audio.js): efeitos sonoros sintetizados com WebAudio.
- [src/hud.js](/c:/repos/batalha-urbana/src/hud.js) e [src/input.js](/c:/repos/batalha-urbana/src/input.js): painel lateral e teclado.
- [src/config.js](/c:/repos/batalha-urbana/src/config.js): constantes de gameplay, temas, spawns e caixas de colisão.
- [src/math.js](/c:/repos/batalha-urbana/src/math.js): transformações geométricas e utilitários.

## Regra importante da migracao

O jogo continua trabalhando em `coordenadas de gameplay` derivadas do legado. O renderer aplica depois a transformacao de camera equivalente ao OpenGL antigo:

- `xTela = xGameplay * 0.2`
- `yTela = (yGameplay - 115) * 0.3`
- viewport ortografica fixa em `[-40, 40]`

Isso isola a logica do jogo do desenho e evita que otimizacoes mudem a posicao de objetos.

## Legado

Repositorio original em C++/OpenGL: <https://github.com/fabio-ag-silveira/BatalhaUrbana_C17>
