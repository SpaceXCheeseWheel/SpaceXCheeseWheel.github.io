// DOVEDALE BOXER - CrazyRocketGuy 2026
// UPDATED 2.0.1h8

const WS_SERVER = "wss://map.dovedale.wiki/api/ws";

const SIGNAL_BOXES = {
	"AB": {
		name: "Ashburn",
		x: -21498,
		y: -6616,
		rad: 13,
	},
	"BL": {
		name: "Benyhone Loop",
		x: -19066,
		y: -4948,
		rad: 12,
	},
	"FM": {
		name: "Fanory Mill",
		x: -16430,
		y: -4047,
		rad: 18,
	},
	"SAT": {
		name: "Satus",
		x: -7282,
		y: -2964,
		rad: 14,
	},
	"DE": {
		name: "Dovedale East",
		x: 853,
		y: 223,
		rad: 28,
	},
	"CH": {
		name: "Cosdale Harbour",
		x: 4383,
		y: -2605,
		rad: 22,
	},
	"DCent": {
		name: "Dovedale Central",
		x: 3058,
		y: 655,
		rad: 33,
	},
	"GE": {
		name: "Gleethrop End",
		x: 1557,
		y: 3286,
		rad: 16,
	},
	"MW": {
		name: "Mazewood",
		x: -4641,
		y: 5789,
		rad: 12,
	},
	"MC": {
		name: "Marigot Crossing",
		x: 7688,
		y: 2181,
		rad: 14,
	},
	"CC": {
		name: "Codsall Castle",
		x: 9977,
		y: 5153,
		rad: 13,
	},
	"GJ": {
		name: "Glassbury Junction",
		x: 11653,
		y: 8040,
		rad: 20,
	},
	"MS": {
		name: "Masonfield",
		x: 10425,
		y: -609,
		rad: 20,
	}
};



// ws client via dovedale-map

const STALE_SERVER_TIMEOUT = 30_000;

const elements = {
	serverSelect: document.getElementById("servers"),
	boxList: document.getElementById("boxList"),
	map: document.getElementById("map")
};

class AppState {
	constructor() {
		this.serverData = {};
		this.currentServer = "default"; // none
		this.currentScale = 1;
		this.ws = null;
		this.reconnectAttempts = 0;
		this.maxReconnectAttempts = 3;
		this.reconnectTimeout = null;
		this.staleCheckInterval = null;
	}

	getAllPlayers() {
		if (this.currentServer === "default") {
			return Object.values(this.serverData)
				.map((serverInfo) => serverInfo.players || [])
				.flat();
		}
		return this.serverData[this.currentServer]?.players || [];
	}
}

const state = new AppState();



const cleanupStaleServers = () => {
	const now = Date.now();
	let hasStaleServers = false;

	for (const [jobId, serverInfo] of Object.entries(state.serverData)) {
		if (now - serverInfo.lastUpdate > STALE_SERVER_TIMEOUT) {
			console.log(`Removing stale server: ${jobId}`);
			delete state.serverData[jobId];
			hasStaleServers = true;
		}
	}

	if (hasStaleServers) {
		updateServerList();
		//drawScene();
	}
};

const startStaleServerCleanup = () => {
	if (state.staleCheckInterval) {
		clearInterval(state.staleCheckInterval);
	}
	console.log("Starting stale server cleanup loop");
	state.staleCheckInterval = setInterval(cleanupStaleServers, 5000); // every 5s
};

const stopStaleServerCleanup = () => {
	if (state.staleCheckInterval) {
		console.log("Stopping stale server cleanup loop");
		clearInterval(state.staleCheckInterval);
		state.staleCheckInterval = null;
	}
};

const createWebSocket = () => {
	if (state.reconnectTimeout) {
		clearTimeout(state.reconnectTimeout);
		state.reconnectTimeout = null;
	}

	if (state.ws) {
		state.ws.close();
		state.ws = null;
	}

	// state.ws = new WebSocket((location.protocol == "http:" ? "ws://" : "wss://") + `${window.location.host}/api/ws`);
	state.ws = new WebSocket(WS_SERVER);
	state.ws.addEventListener("open", () => {
		console.log("WebSocket connected");
		state.reconnectAttempts = 0;
		// hideConnectionPopup();
		startStaleServerCleanup();
	});

	state.ws.addEventListener("message", (event) => {
		try {
			const data = JSON.parse(event.data);
			const jobId = data.jobId;
			const playersArray = Array.isArray(data.players) ? data.players : [];

			if (playersArray.length === 0 && data.serverShutdown) {
				delete state.serverData[jobId];
			} else {
				state.serverData[jobId] = {
					players: playersArray,
					lastUpdate: Date.now(),
				};
			}
			updateServerList(data);

			updateBoxList(data);
			// drawScene();
		} catch (err) {
			console.error("Error parsing data", err);
		}
	});

	state.ws.addEventListener("error", (err) => {
		console.warn("WebSocket error:", err);
	});

	state.ws.addEventListener("close", (event) => {
		console.warn("WebSocket closed:", event.code, event.reason);
		showConnectionPopup();
		stopStaleServerCleanup();

		if (
			state.reconnectAttempts < state.maxReconnectAttempts &&
			!state.reconnectTimeout
		) {
			state.reconnectTimeout = setTimeout(() => {
				state.reconnectTimeout = null;
				attemptReconnect();
			}, 1000);
		}
	});

	return state.ws;
};


const attemptReconnect = () => {
	if (state.reconnectTimeout) {
		return;
	}

	if (state.reconnectAttempts >= state.maxReconnectAttempts) {
		updateReconnectButton();
		return;
	}

	state.reconnectAttempts++;

	elements.reconnectBtn.disabled = true;
	elements.reconnectBtn.classList.add("bg-zinc-600");
	elements.reconnectBtn.classList.remove("bg-blue-600", "hover:bg-blue-700");

	elements.reconnectBtn.innerHTML = `
		<i id="reconnectIcon" class="material-symbols-outlined text-4 animate-spin">refresh</i>
		Connecting...
	`;

	if (state.ws && state.ws.readyState !== WebSocket.CLOSED) {
		state.ws.close();
	}

	createWebSocket();
};


const resetReconnection = () => {
	state.reconnectAttempts = 0;
	if (state.reconnectTimeout) {
		clearTimeout(state.reconnectTimeout);
		state.reconnectTimeout = null;
	}
};

const processPlayerData = (data = null) => {
	if (data?.players) {
		const playersArray = Array.isArray(data.players) ? data.players : [];

		playersArray.forEach((player) => {
			if (!player.trainData || !Array.isArray(player.trainData)) return;
			const trainData = player.trainData;

			if (typeof trainData !== "object" || trainData === null) {
				player.trainData = null;
				return;
			}

			player.trainData = [
				trainData.destination || "Unknown",
				trainData.class || "Unknown",
				trainData.headcode || "----",
				trainData.headcodeClass || "",
			];
		});
		return playersArray;
	}

}

const updateBoxList = (data = null) => {
	console.log("==BOX LIST==")
	const playersArray = processPlayerData(data);

	const selectedValue = elements.serverSelect.value;

	if (selectedValue == "default") {
		return;
	}

	let occupiedBoxes = new Set();

	state.serverData[selectedValue].players.forEach((player) => {
		Object.entries(SIGNAL_BOXES).forEach(([box, { name, x, y, rad }]) => {
			const distance = Math.sqrt(
				(player.position.x - x) ** 2 + (player.position.y - y) ** 2
			);
			if (distance < rad) {
				console.log(`Player ${player.username} is in box ${name}`);
				occupiedBoxes[box] ? (occupiedBoxes[box] += ` <i>and</i> ` + player.username) : occupiedBoxes[box] =player.username;

			}
		});
	});
	let html = `<tr><td>Box</td><td>Status</td><td>Player</td></tr>`;
	Object.entries(SIGNAL_BOXES).forEach(([box, { name }]) => {
		html += `<tr><td>[${box}] ${name}</td><td>${occupiedBoxes[box] ? "✓" : "X"}</td><td>${occupiedBoxes[box] || "<div style='color: #888;'>Empty</div>"}</td></tr>`;
		elements.map.getElementById(box)?.setAttribute("fill", occupiedBoxes[box] ? "green" : "red");
	});
	elements.boxList.innerHTML = html;

	

}

const updateServerList = (data = null) => {
	const currentServers = Object.keys(state.serverData);
	const existingServers = Array.from(elements.serverSelect.options)
		.slice(1)
		.map((opt) => opt.value);

	const playersArray = processPlayerData(data);

	// this will constantly recreate the options which can
	//  make selecting an option difficult on certain browsers
	// TODO: only update when required
	const selectedValue = elements.serverSelect.value;

	const totalPlayersCount = Object.values(state.serverData).reduce(
		(count, serverInfo) =>
			count +
			(Array.isArray(serverInfo.players) ? serverInfo.players.length : 0),
		0,
	);

	let html = `<option value="default">Select Server</option>`;

	currentServers.forEach((jobId) => {
		const serverName =
			jobId.length > 6
				? `Server ${jobId.substring(jobId.length - 6)}`
				: `Server ${jobId}`;
		const playerCount = Array.isArray(state.serverData[jobId]?.players)
			? state.serverData[jobId].players.length
			: 0;
		const selected = selectedValue === jobId ? " selected" : "";
		html += `<option value="${jobId}"${selected}>${serverName} (${playerCount} / 50 players)</option>`;
	});

	elements.serverSelect.innerHTML = html;

	if (selectedValue !== "default" && !currentServers.includes(selectedValue)) {
		elements.serverSelect.value = "default";
		state.currentServer = "default";
	} else {
		elements.serverSelect.value = selectedValue;
	}
};

elements.serverSelect.addEventListener("change", () => {
	state.currentServer = elements.serverSelect.value;
});

const start = () => {
	elements.serverSelect.innerHTML =
		'<option value="default">Select Server</option>';
	createWebSocket();
};

start();