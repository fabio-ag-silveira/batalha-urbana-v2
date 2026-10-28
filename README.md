# Batalha Urbana

Migracao do projeto original em C++ para uma versao web moderna com `HTML + CSS + JavaScript modular`.

## Como executar

Esta versão é um site 100% estático (HTML + CSS + JS), publicado no **Cloudflare Workers** com Static Assets. Não há servidor nem modo LAN.

```powershell
npm install      # instala o wrangler (só na primeira vez)
npm run dev      # servidor local em http://127.0.0.1:8787
```

## Publicar no Cloudflare Workers

```powershell
npx wrangler login   # abre o navegador para entrar na sua conta Cloudflare
npm run deploy       # publica em https://batalha-urbana.<sua-conta>.workers.dev
```

Para usar um domínio próprio, o domínio precisa estar na sua conta Cloudflare. Depois, no painel, vá em **Workers & Pages → batalha-urbana → Settings → Domains & Routes → Add → Custom domain**.

A configuração fica em [wrangler.jsonc](/c:/repos/batalha-urbana/wrangler.jsonc). O arquivo [.assetsignore](/c:/repos/batalha-urbana/.assetsignore) lista o que não deve ser publicado (README, `node_modules`, configs).

## Como jogar

Cada rodada acontece num **arquipélago novo**, gerado a partir de uma seed: 3 ou 4 ilhas com morros, praias e prédios. Cada jogador começa com 100 HP. Vence a rodada quem destruir o carrinho adversário **ou derrubá-lo no mar**, e a partida vai para quem vencer 3 rodadas.

| | Mira | Mover | Atirar | Arma |
|---|---|---|---|---|
| Player 1 | W/S | A/D | segure F e solte | Q |
| Player 2 | I/K | J/L | segure H e solte | O |
| Jogador da vez (vs IA) | ↑/↓ | ←/→ | segure Espaço e solte | Tab |

- **Força:** segurar o disparo enche a barra em vai-e-vem; soltar atira. A marca branca mostra a força do tiro anterior.
- **Vento:** muda a cada turno e aparece no painel do topo (as nuvens também seguem o vento).
- **Explosões:** causam dano em área (acerto direto dá bônus), inclusive em quem atirou, e **empurram** o carrinho atingido para longe do impacto.
- **Cenário destrutível:** cada explosão abre uma cratera no terreno e nos prédios. Carrinhos sem apoio caem, e quedas altas causam dano.
- **Mar:** carrinho que cai na água afunda e perde a rodada. Tiros na água ferem, mas não abrem cratera; o Quicante ricocheteia na superfície.
- **Movimento:** cada turno tem combustível limitado (barra amarela sob o HP). O carrinho sobe e desce encostas, mas não entra no mar dirigindo nem escala paredes.
- **Timer:** 20 s por turno. Se acabar durante a carga, o tiro sai com a força atual; senão, a vez passa.
- **Armas especiais** (munição por rodada):
  - **✸ Fragmentação (×2):** explode e solta 4 fragmentos.
  - **◎ Quicante (×2):** quica até 2 vezes antes de explodir.
  - **⬣ Pesado (×1):** explosão grande e cratera funda.
  - O **● Canhão** comum é ilimitado. A IA também usa as especiais.
- **Condições da rodada** (às vezes; aparece um selo no topo da tela):
  - **Tempestade:** vento até o dobro, com chuva.
  - **Gravidade baixa:** os tiros vão mais alto e mais longe.
  - **Neblina:** o indicador de vento some.
  - **Arsenal:** munição especial em dobro.
- **Caixas de suprimento:** a partir do 3º turno, caixas podem cair de paraquedas sobre as ilhas: **vida** (+30 HP), **combustível** (+30) ou **munição** (+1 arma especial). Pega quem encostar o carrinho nela ou acertar um tiro que a atravesse. Explosões perto destroem a caixa, e a que cai no mar se perde.
- **Câmera dinâmica:** enquadra os dois carrinhos, segue o projétil e mostra o impacto. `C` (ou o botão no menu) alterna para a câmera fixa.
- **Atalhos:** `B` reinicia, `M` alterna IA/local, `N` muda a dificuldade da IA, `U` liga/desliga o som, `C` troca a câmera.

### No celular ou tablet

- Jogue com o aparelho **na horizontal**. Na vertical aparece um aviso, que pode ser dispensado.
- Os botões na parte de baixo da tela fazem o mesmo que o teclado: ◀ ▶ movem, **ARMA** troca a arma, ▲ ▼ giram o canhão, e **ATIRAR** funciona segurando para carregar e soltando para disparar.
- O botão ☰ abre o menu (modo, dificuldade, som e nova partida), e ⛶ ativa a tela cheia nos navegadores que suportam.

## Estrutura

- [src/game.js](/c:/repos/batalha-urbana/src/game.js): estado da partida, fases do turno, entrada, dano, quedas e IA.
- [src/map.js](/c:/repos/batalha-urbana/src/map.js): gerador do arquipélago (terreno, prédios e pontos de spawn) a partir da seed da rodada.
- [src/physics.js](/c:/repos/batalha-urbana/src/physics.js): trajetória com vento e gravidade, colisão com terreno/prédios/crateras, água e movimento dos carrinhos.
- [src/scene.js](/c:/repos/batalha-urbana/src/scene.js): céu, ilhas, mar, carrinhos, caixas, clima e painel do topo.
- [src/renderer.js](/c:/repos/batalha-urbana/src/renderer.js): renderer Canvas, conversão de coordenadas e camadas em cache.
- [src/camera.js](/c:/repos/batalha-urbana/src/camera.js): câmera dinâmica (zoom e acompanhamento), só no desenho.
- [src/effects.js](/c:/repos/batalha-urbana/src/effects.js): partículas, tremor de tela, textos de dano e banners (só no cliente).
- [src/audio.js](/c:/repos/batalha-urbana/src/audio.js): efeitos sonoros sintetizados com WebAudio.
- [src/hud.js](/c:/repos/batalha-urbana/src/hud.js) e [src/input.js](/c:/repos/batalha-urbana/src/input.js): painel lateral e teclado.
- [src/config.js](/c:/repos/batalha-urbana/src/config.js): constantes de gameplay, armas, temas, gerador de mapa, condições da rodada e caixas de suprimento.
- [src/math.js](/c:/repos/batalha-urbana/src/math.js): transformações geométricas e utilitários.

## Coordenadas

O mapa fixo do legado deu lugar ao arquipélago procedural, mas o jogo continua usando as `coordenadas de gameplay` do original. O nível do mar (`y = -16`) é o antigo nível da rua. O renderer converte para a tela com a mesma transformação do OpenGL antigo:

- `xTela = xGameplay * 0.2`
- `yTela = (yGameplay - 115) * 0.3`

Por cima disso entram só ajustes de desenho: a câmera dinâmica (zoom e acompanhamento) e a proporção da tela. A lógica do jogo não depende deles, e o mapa inteiro sai da seed, o que mantém o estado da partida pequeno.

## Legado

Repositorio original em C++/OpenGL: <https://github.com/fabio-ag-silveira/BatalhaUrbana_C17>
