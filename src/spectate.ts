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

const INITIAL_REPLAY_DELAY_MS = 330;

export default class SpectateCtrl implements BoardCtrl {
  ground?: CgApi;
  chess: Chess = Chess.default();
  lastUpdateAt: number = Date.now();
  redrawInterval: ReturnType<typeof setInterval>;
  replayQueue: any[] = [];
  replayTimer?: ReturnType<typeof setTimeout>;
  replayInitialBurst: boolean;

  constructor(
    readonly stream: Stream,
    public game: SpectateGame,
    readonly root: Ctrl,
    replayInitialBurst: boolean,
  ) {
    this.replayInitialBurst = replayInitialBurst;
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
    if (this.replayTimer) {
      clearTimeout(this.replayTimer);
      this.replayTimer = undefined;
    }
    this.replayQueue = [];
  };

  player = (color: Color) => this.game.players[this.game.players[0].color === color ? 0 : 1];

  static open = (root: Ctrl, id: string): Promise<SpectateCtrl> =>
    new Promise<SpectateCtrl>((resolve, reject) => {
      let ctrl: SpectateCtrl;
      let stream: Stream;
      let streamReady = false;
      const pendingMessages: any[] = [];
      const handler = (msg: any) => {
        if (!streamReady) {
          pendingMessages.push(msg);
          return;
        }
        if (ctrl) {
          ctrl.handle(msg);
        } else {
          ctrl = new SpectateCtrl(stream, normalizeGame(msg, root), root, shouldReplayInitialBurst(msg));
          resolve(ctrl);
        }
      };
      void root.auth
        .openStream(`/api/stream/game/${id}`, {}, handler)
        .then(openedStream => {
          stream = openedStream;
          streamReady = true;
          for (const pending of pendingMessages.splice(0)) {
            handler(pending);
          }
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

  private scheduleReplay = () => {
    if (this.replayTimer || this.replayQueue.length === 0) {
      return;
    }

    this.replayTimer = setTimeout(() => {
      this.replayTimer = undefined;
      const next = this.replayQueue.shift();
      if (next) {
        this.applyMessage(next);
      }

      if (this.replayQueue.length > 0) {
        this.scheduleReplay();
      } else {
        // Initial burst has been fully replayed; switch to live updates.
        this.replayInitialBurst = false;
      }
    }, INITIAL_REPLAY_DELAY_MS);
  };

  private applyMessage = (msg: any) => {
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

  private handle = (msg: any) => {
    if (this.replayInitialBurst) {
      this.replayQueue.push(msg);
      this.scheduleReplay();
      return;
    }

    this.applyMessage(msg);
  };
}

const STANDARD_START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

const normalizeInitialFen = (fen?: string) => {
  if (!fen || fen === 'startpos') {
    return STANDARD_START_FEN;
  }
  return fen;
};

const shouldReplayInitialBurst = (game: SpectateStreamGame) => {
  const referenceFen = normalizeInitialFen(game.initialFen);
  return game.fen === undefined || game.fen !== referenceFen || typeof game.lastMove === 'string';
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