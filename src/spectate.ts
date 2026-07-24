import { type Api as CgApi } from '@lichess-org/chessground/api';
import { type Key } from '@lichess-org/chessground/types';
import { Chess, type Color } from 'chessops';
import { parseFen } from 'chessops/fen';

import { type Ctrl } from './ctrl';
import { type BoardCtrl } from './game';
import { type Stream } from './ndJsonStream';

interface SpectateStreamGame {
  id: string;
  fen?: string;
  initialFen?: string;
  lastMove?: string;
  players: {
    white: SpectateStreamPlayer;
    black: SpectateStreamPlayer;
  };
}

interface SpectateStreamPlayer {
  user?: {
    id: string;
    name: string;
    title?: string;
  };
  rating?: number;
}

interface SpectateGame {
  id: string;
  orientation: Color;
  players: [SpectatePlayer, SpectatePlayer];
  fen: string;
  lastMove?: string;
}

interface SpectatePlayer {
  color: Color;
  user: {
    name: string;
    title?: string;
  };
  rating?: number;
  seconds?: number;
}

export default class SpectateCtrl implements BoardCtrl {
  ground?: CgApi;
  chess: Chess = Chess.default();
  lastUpdateAt: number = Date.now();
  redrawInterval: ReturnType<typeof setInterval>;

  constructor(
    readonly stream: Stream,
    public game: SpectateGame,
    readonly root: Ctrl,
  ) {
    this.onUpdate();
    this.redrawInterval = setInterval(root.redraw, 100);
    this.awaitClose();
  }

  awaitClose = async () => {
    await this.stream.closePromise;
  };

  onUnmount = () => {
    this.stream.close();
    clearInterval(this.redrawInterval);
  };

  player = (color: Color) => this.game.players[this.game.players[0].color === color ? 0 : 1];

  static open = (root: Ctrl, id: string): Promise<SpectateCtrl> =>
    new Promise<SpectateCtrl>((resolve, reject) => {
      let ctrl: SpectateCtrl;
      let stream: Stream;
      const handler = (msg: any) => {
        if (ctrl) {
          ctrl.handle(msg);
        } else {
          ctrl = new SpectateCtrl(stream, normalizeGame(msg, root), root);
          resolve(ctrl);
        }
      };
      void root.auth
        .openStream(`/api/stream/game/${id}`, {}, handler)
        .then(openedStream => {
          stream = openedStream;
        })
        .catch(reject);
    });

  chessgroundConfig = () => {
    const chess = Chess.fromSetup(parseFen(this.game.fen).unwrap()).unwrap();
    const lm = this.game.lastMove;
    const lastMove = (lm ? (lm[1] === '@' ? [lm.slice(2)] : [lm[0] + lm[1], lm[2] + lm[3]]) : []) as Key[];
    return {
      orientation: this.game.orientation,
      fen: this.game.fen,
      lastMove,
      turnColor: chess.turn,
      check: chess.isCheck(),
      viewOnly: true,
      movable: { free: false },
      drawable: { visible: false },
      coordinates: false,
    };
  };

  setGround = (cg: CgApi) => (this.ground = cg);

  private onUpdate = () => {
    this.chess = Chess.fromSetup(parseFen(this.game.fen).unwrap()).unwrap();
    this.lastUpdateAt = Date.now();
  };

  private handle = (msg: any) => {
    const isGameSnapshot = !!msg.players && !!msg.id;
    if (isGameSnapshot) {
      this.game = normalizeGame(msg, this.root, this.game);
    }

    const hasFenUpdate = typeof msg.fen === 'string';
    if (hasFenUpdate) {
      this.game.fen = msg.fen;
    }

    if (typeof msg.lm === 'string') {
      this.game.lastMove = msg.lm;
    } else if (typeof msg.lastMove === 'string') {
      this.game.lastMove = msg.lastMove;
    }

    if (typeof msg.wc === 'number') {
      this.player('white').seconds = msg.wc;
    }
    if (typeof msg.bc === 'number') {
      this.player('black').seconds = msg.bc;
    }

    if (isGameSnapshot || hasFenUpdate) {
      this.onUpdate();
      this.ground?.set(this.chessgroundConfig());
      this.root.redraw();
    }
  };
}

const STANDARD_START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

const normalizeInitialFen = (fen?: string) => {
  if (!fen || fen === 'startpos') {
    return STANDARD_START_FEN;
  }
  return fen;
};

const normalizeGame = (game: SpectateStreamGame, root: Ctrl, previous?: SpectateGame): SpectateGame => {
  const white = game.players.white;
  const black = game.players.black;
  const me = root.auth.me?.id;
  const orientation: Color =
    me && white.user?.id === me
      ? 'white'
      : me && black.user?.id === me
        ? 'black'
        : previous?.orientation || 'white';
  return {
    id: game.id,
    orientation,
    fen: game.fen || previous?.fen || normalizeInitialFen(game.initialFen),
    lastMove: game.lastMove,
    players: [
      {
        color: 'white',
        user: {
          name: white.user?.name || 'Anon',
          title: white.user?.title,
        },
        rating: white.rating,
      },
      {
        color: 'black',
        user: {
          name: black.user?.name || 'Anon',
          title: black.user?.title,
        },
        rating: black.rating,
      },
    ],
  };
};