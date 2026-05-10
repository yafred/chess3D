import { Auth } from './auth';
import ChallengeCtrl from './challenge';
import { GameCtrl } from './game';
import { type Page } from './interfaces';
import { type Stream } from './ndJsonStream';
import OngoingGames from './ongoingGames';
import { PuzzleCtrl } from './puzzle';
import { SeekCtrl } from './seek';
import TvCtrl from './tv';
import { formData } from './util';

export class Ctrl {
  auth: Auth = new Auth();
  stream?: Stream;
  page: Page = 'home';
  games = new OngoingGames();
  game?: GameCtrl;
  seek?: SeekCtrl;
  challenge?: ChallengeCtrl;
  tv?: TvCtrl;
  puzzle?: PuzzleCtrl;

  constructor(readonly redraw: () => void) {}

  openHome = async () => {
    this.page = 'home';
    if (this.auth.me) {
      this.redraw();
      await this.stream?.close();
      this.games.empty();
      this.stream = await this.auth.openStream('/api/stream/event', {}, msg => {
        switch (msg.type) {
          case 'gameStart':
            this.games.onStart(msg.game);
            break;
          case 'gameFinish':
            this.games.onFinish(msg.game);
            break;
          default:
            console.warn(`Unprocessed message of type ${msg.type}`, msg);
        }
        this.redraw();
      });
    }
    this.redraw();
  };

  openPuzzle = async () => {
    this.page = 'puzzle';
    this.puzzle = new PuzzleCtrl(this);
    this.redraw();
  };

  openGame = async (id: string) => {
    this.page = 'game';
    this.game = undefined;
    this.redraw();
    this.game = await GameCtrl.open(this, id);
    this.redraw();
  };

  playAi = async () => {
    this.game = undefined;
    this.page = 'game';
    this.redraw();
    await this.auth.fetchBody('/api/challenge/ai', {
      method: 'post',
      body: formData({
        level: 1,
        'clock.limit': 60 * 3,
        'clock.increment': 2,
      }),
    });
  };

  playPool = async (minutes: number, increment: number) => {
    this.seek = await SeekCtrl.make(
      {
        rated: true,
        time: minutes,
        increment: increment,
      },
      this,
    );
    this.page = 'seek';
    this.redraw();
  };

  playMaia = async (minutes: number, increment: number) => {
    this.challenge = await ChallengeCtrl.make(
      {
        username: 'maia1',
        rated: false,
        'clock.limit': minutes * 60,
        'clock.increment': increment,
      },
      this,
    );
    this.page = 'challenge';
    this.redraw();
  };

  watchTv = async () => {
    this.page = 'tv';
    this.redraw();
    this.tv = await TvCtrl.open(this);
    this.redraw();
  };
}
