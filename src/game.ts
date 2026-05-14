import { type Api as CgApi } from '@lichess-org/chessground/api';
import { type Config as CgConfig } from '@lichess-org/chessground/config';
import { type Color, type Key, type Role } from '@lichess-org/chessground/types';
import { Chess, defaultSetup } from 'chessops';
import { chessgroundDests } from 'chessops/compat';
import { makeFen, parseFen } from 'chessops/fen';
import { opposite, parseSquare, parseUci } from 'chessops/util';

import { type Ctrl } from './ctrl';
import { type Game } from './interfaces';
import { type Stream } from './ndJsonStream';

export interface BoardCtrl {
  chess: Chess;
  ground?: CgApi;
  chessgroundConfig: () => CgConfig;
  setGround: (cg: CgApi) => void;
}

export class GameCtrl implements BoardCtrl {
  game: Game;
  pov: Color;
  chess: Chess = Chess.default();
  lastMove?: [Key, Key];
  lastUpdateAt: number = Date.now();
  ground?: CgApi;
  redrawInterval: ReturnType<typeof setInterval>;
  promotionRole: Role = 'queen';

  constructor(
    game: Game,
    readonly stream: Stream,
    private root: Ctrl,
  ) {
    this.game = game;
    this.pov = this.game.black.id === this.root.auth.me?.id ? 'black' : 'white';
    this.onUpdate();
    this.redrawInterval = setInterval(root.redraw, 100);
  }

  onUnmount = () => {
    this.stream.close();
    clearInterval(this.redrawInterval);
  };

  private onUpdate = () => {
    const setup =
      this.game.initialFen === 'startpos' ? defaultSetup() : parseFen(this.game.initialFen).unwrap();
    this.chess = Chess.fromSetup(setup).unwrap();
    const moves = this.game.state.moves.split(' ').filter(Boolean);
    moves.forEach((uci: string) => this.chess.play(parseUci(uci)!));
    const lastMove = moves[moves.length - 1];
    this.lastMove = lastMove && [lastMove.slice(0, 2) as Key, lastMove.slice(2, 4) as Key];
    this.lastUpdateAt = Date.now();
    this.ground?.set(this.chessgroundConfig());
    if (this.chess.turn === this.pov) {
      this.ground?.playPremove();
    }
  };

  setPromotionRole = (role: Role) => {
    this.promotionRole = role;
  };

  timeOf = (color: Color) => this.game.state[`${color[0]}time`];

  userMove = async (orig: Key, dest: Key) => {
    this.ground?.set({ turnColor: opposite(this.pov) });
    const from = parseSquare(orig);
    const movingRole = this.chess.board.getRole(from!);
    const doPromote =
      movingRole === 'pawn' &&
      ((dest[1] === '8' && this.chess.turn === 'white') || (dest[1] === '1' && this.chess.turn === 'black'));
    const promotionPart = doPromote ? this.promotionRole[0] : '';

    await this.root.auth.fetchBody(`/api/board/game/${this.game.id}/move/${orig}${dest}${promotionPart}`, {
      method: 'post',
    });
  };

  resign = async () => {
    await this.root.auth.fetchBody(`/api/board/game/${this.game.id}/resign`, { method: 'post' });
  };

  playing = () => this.game.state.status === 'started';

  chessgroundConfig = () => ({
    model3D: {
      sceneAssetUrl: SCENE_ASSET_URL,
    },
    orientation: this.pov,
    fen: makeFen(this.chess.toSetup()),
    lastMove: this.lastMove,
    turnColor: this.chess.turn,
    check: !!this.chess.isCheck(),
    movable: {
      free: false,
      color: this.playing() ? this.pov : undefined,
      dests: chessgroundDests(this.chess),
    },
    events: {
      move: this.userMove,
    },
  });

  setGround = (cg: CgApi) => (this.ground = cg);

  static open = (root: Ctrl, id: string): Promise<GameCtrl> =>
    new Promise<GameCtrl>(resolve => {
      let ctrl: GameCtrl;
      let stream: Stream;
      const handler = (msg: any) => {
        if (ctrl) {
          ctrl.handle(msg);
        } else {
          // Gets the gameFull object from the first message of the stream,
          // make a GameCtrl from it, then forward the next messages to the ctrl
          ctrl = new GameCtrl(msg, stream, root);
          resolve(ctrl);
        }
      };
      void (async () => {
        stream = await root.auth.openStream(`/api/board/game/stream/${id}`, {}, handler);
      })();
    });

  private handle = (msg: any) => {
    switch (msg.type) {
      case 'gameFull':
        this.game = msg;
        this.onUpdate();
        this.root.redraw();
        break;
      case 'gameState':
        this.game.state = msg;
        this.onUpdate();
        this.root.redraw();
        break;
      default:
        console.error(`Unknown message type: ${msg.type}`, msg);
    }
  };
}
