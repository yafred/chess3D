type SetupLichessParams = {
    onServerMove?: (uci: string) => void;
    onGameStart?: () => void;
};

export type LichessController = {
    userMove: (uci: string) => boolean;
    onServerMove?: (uci: string) => void;
};

export function setupLichessInteraction({
    onServerMove,
    onGameStart,
}: SetupLichessParams): LichessController {

    const CLIENT_ID = "chess3D";
    const REDIRECT_URI = location.origin + location.pathname;
    const SCOPES = "board:play";
    // const HOST = "https://lichess.org";
    const HOST = "http://localhost:9663";
    let appliedMoveCount = 0;

    function getMovesFromState(movesText: unknown): string[] {
        if (typeof movesText !== "string") {
            return [];
        }

        return movesText
            .trim()
            .split(/\s+/)
            .filter(Boolean);
    }

    function emitNewMoves(movesText: unknown) {
        const allMoves = getMovesFromState(movesText);
        if (allMoves.length === 0) {
            appliedMoveCount = 0;
            return;
        }

        if (allMoves.length < appliedMoveCount) {
            appliedMoveCount = 0;
        }

        const unseenMoves = allMoves.slice(appliedMoveCount);
        for (const move of unseenMoves) {
            if (onServerMove) {
                onServerMove(move);
            }
        }

        appliedMoveCount = allMoves.length;
    }

    async function connectGameStream() {
        const token = localStorage.getItem("lichess_token");
        const gameId = localStorage.getItem("lichess_game");
        if (!token || !gameId) {
            console.warn("Missing token or game ID for Lichess stream.");
            return;
        }
        const res = await fetch(`${HOST}/api/board/game/stream/${gameId}`, {
            headers: { Authorization: `Bearer ${token}` }
        });

        if (!res.ok || !res.body) {
            console.warn("Failed to connect to Lichess game stream.", res.status, res.statusText);
            return;
        }

        console.log('Connected to Lichess game stream');
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buf = "";

        while (true) {
            const { value, done } = await reader.read();
            if (done) break;
            buf += decoder.decode(value, { stream: true });

            const lines = buf.split("\n");
            buf = lines.pop();

            for (const line of lines) {
                if (!line.trim()) continue;
                try {
                    const msg = JSON.parse(line);
                    console.log(JSON.stringify(msg));
                    // if msg.type === "gameFull" we can get the initial position and the uci moves in msg.state.moves
                    if (msg.type === "gameFull") {
                        if (onGameStart) onGameStart();
                        emitNewMoves(msg.state?.moves);
                    }
                    // if msg.type === "gameState" we can get the uci moves in msg.moves
                    else if (msg.type === "gameState") {
                        emitNewMoves(msg.moves);
                    }
                } catch { 
                    console.warn("Failed to parse Lichess stream message:", line);
                }
            }
        }
    }

    connectGameStream();
    return {
        userMove: (uci: string) => {
            console.log('User move attempt:', uci);
            const token = localStorage.getItem("lichess_token");
            const gameId = localStorage.getItem("lichess_game");
            if (!token || !gameId) {
                return true; // Accept all moves by default
            }
            fetch(`${HOST}/api/board/game/${gameId}/move/${uci}`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });
            return true;
        }
    }
}