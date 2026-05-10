import { type VNode } from 'snabbdom';

import { type Ctrl } from './ctrl';

export type Page = 'home' | 'game' | 'seek' | 'challenge' | 'tv' | 'puzzle';

export type MaybeVNodes = (VNode | string | undefined)[];
export type Renderer = (ctrl: Ctrl) => MaybeVNodes;

export type Game = Record<string, any>;
