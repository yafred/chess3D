import { type Api as CgApi } from '@lichess-org/chessground/api';
import { type Color, type Key, type Role } from '@lichess-org/chessground/types';
import { Chess } from 'chessops';
import { chessgroundDests } from 'chessops/compat';
import { makeFen, parseFen } from 'chessops/fen';
import { parseSan } from 'chessops/san';
import { type NormalMove } from 'chessops/types';
import { makeUci, parseSquare, parseUci } from 'chessops/util';

import { type Ctrl } from './ctrl';
import { type BoardCtrl } from './game';

interface Puzzle {
  id: string;
  solution: string[];
  initialPly: number;
  pov: Color;
}

interface PuzzleGame {
  pgn: string;
}

interface PuzzleResponse {
  puzzle: Puzzle;
  game: PuzzleGame;
}

export class PuzzleCtrl implements BoardCtrl {
  chess: Chess = Chess.default();
  lastMove?: [Key, Key];
  ground?: CgApi;
  puzzle?: Puzzle;
  puzzleGame?: PuzzleGame;
  puzzleId = '';
  puzzleTheme = '';
  canMove = false;
  solutionIndex = 0;
  promotionRole: Role = 'queen';

  constructor(private root: Ctrl) {
    this.onUpdate();
  }

  private onUpdate = () => {
    this.ground?.set(this.chessgroundConfig());
  };

  chessgroundConfig = () => ({
    orientation: this.puzzle ? this.puzzle.pov : 'white',
    fen: makeFen(this.chess.toSetup()),
    lastMove: this.lastMove,
    turnColor: this.chess.turn,
    check: !!this.chess.isCheck(),
    viewOnly: !this.canMove,
    movable: {
      free: false,
      color: this.canMove ? this.chess.turn : undefined,
      dests: chessgroundDests(this.chess),
    },
    events: {
      move: this.userMove,
    },
  });

  userMove = async (orig: Key, dest: Key) => {
    const beforeMoveFen = makeFen(this.chess.toSetup());
    const beforeMoveLastMove = this.lastMove;
    const move = parseUci(`${orig}${dest}`);
    if (!move) {
      return;
    }

    const normalMove = move as NormalMove;
    const from = parseSquare(orig);

    // Detect promotion
    const movingRole = this.chess.board.getRole(from!);
    if (
      movingRole === 'pawn' &&
      ((dest[1] === '8' && this.chess.turn === 'white') || (dest[1] === '1' && this.chess.turn === 'black'))
    ) {
      normalMove.promotion = this.promotionRole;
    }

    this.chess.play(normalMove);
    this.lastMove = [orig, dest];
    this.canMove = false;
    this.onUpdate();

    // Compare move to solution after 200ms
    setTimeout(() => {
      if (!this.puzzle) {
        return;
      }
      const userMoveUci = makeUci(normalMove);
      const expectedMove = this.puzzle.solution[this.solutionIndex];

      if (userMoveUci === expectedMove) {
        if (this.solutionIndex + 2 < this.puzzle.solution.length) {
          const opponentMove = this.puzzle.solution[this.solutionIndex + 1];
          const opponentMoveParsed = parseUci(opponentMove);
          if (opponentMoveParsed) {
            this.chess.play(opponentMoveParsed);
            this.lastMove = [opponentMove.slice(0, 2) as Key, opponentMove.slice(2, 4) as Key];
          }
          this.solutionIndex += 2;
          this.canMove = true;
          setTimeout(() => {
            this.onUpdate();
          }, 200);
        } else {
          this.markAsSolved(true);
          alert('Puzzle solved!');
        }
      } else {
        const restoredSetup = parseFen(beforeMoveFen).unwrap();
        this.chess = Chess.fromSetup(restoredSetup).unwrap();
        this.lastMove = beforeMoveLastMove;
        this.canMove = true;
        this.onUpdate();
      }
    }, 200);
  };

  private pgnMoves = (pgn: string): string[] =>
    pgn
      .replace(/\{[^}]*\}|\([^)]*\)|\$\d+/g, ' ')
      .split(/\s+/)
      .filter(token => token && !/^\d+\.(\.\.)?$/.test(token) && !/^(1-0|0-1|1\/2-1\/2|\*)$/.test(token));

  private lastMoveFromPgn = (pgn: string, initialPly: number): [[Key, Key] | undefined, Chess] => {
    const chess = Chess.default();
    const moves = this.pgnMoves(pgn);
    const firstMoveOfPuzzle = Math.max(0, initialPly + 1);
    let lastMove: [Key, Key] | undefined;

    for (let i = 0; i < Math.min(firstMoveOfPuzzle, moves.length); i++) {
      const move = parseSan(chess, moves[i]);
      if (!move) {
        return [undefined, chess];
      }

      const uci = makeUci(move);
      if (uci.length >= 4 && uci[1] !== '@') {
        lastMove = [uci.slice(0, 2) as Key, uci.slice(2, 4) as Key];
      }
      chess.play(move);
    }

    return [lastMove, chess];
  };

  setPromotionRole = (role: Role) => {
    this.promotionRole = role;
  };

  setGround = (cg: CgApi) => (this.ground = cg);

  setPuzzleId = (id: string) => {
    this.puzzleId = id;
  };

  setPuzzleTheme = (theme: string) => {
    this.puzzleTheme = theme;
  };

  private initPuzzle = async (puzzleResponse: PuzzleResponse) => {
    this.puzzle = puzzleResponse.puzzle;
    if (this.puzzle) {
      this.setPuzzleId(this.puzzle.id);
      [this.lastMove, this.chess] = this.lastMoveFromPgn(
        (puzzleResponse.game as PuzzleGame).pgn,
        this.puzzle.initialPly,
      );
      this.canMove = true;
      this.solutionIndex = 0;
      this.puzzle.pov = this.chess.turn;

      this.onUpdate();
    }
  };

  dailyPuzzle = async () => {
    this.initPuzzle(await this.root.auth.fetchBody(`/api/puzzle/daily`, { method: 'get' }));
  };

  puzzleById = async (id: string) => {
    this.initPuzzle(await this.root.auth.fetchBody(`/api/puzzle/${id}`, { method: 'get' }));
  };

  nextPuzzle = async () => {
    this.initPuzzle(
      await this.root.auth.fetchBody(
        `/api/puzzle/next?angle=${this.puzzleTheme ? this.puzzleTheme : 'mix'}`,
        { method: 'get' },
      ),
    );
  };

  markAsSolved = async (solved: boolean) => {
    if (!this.puzzle) {
      return;
    }
    await this.root.auth.fetchBody(`/api/puzzle/batch/mix`, {
      method: 'post',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ solutions: [{ id: this.puzzleId, win: solved, rated: false }] }),
    });
  };
}
