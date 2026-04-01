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
	map: document.getElementById("map"),
	connectionStatus: document.getElementById("connectionStatus"),
	serverStats: document.getElementById("serverStats"),
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
		this.leaderboardData = {};
		this.lastSeenOccupiedBox = new Set();
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
		elements.connectionStatus.setAttribute("fill", "yellow"); // connection established, don't turn green till we get data.
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

			// each time we get data, do a blip!
			elements.connectionStatus.setAttribute("fill", "lightGreen");
			setTimeout(() => {
				elements.connectionStatus.setAttribute("fill", "forestgreen");
			}, 100);

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
		// showConnectionPopup();
		connectionStatus.setAttribute("fill", "red");
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
		// updateReconnectButton();
		return;
	}

	state.reconnectAttempts++;

	// elements.reconnectBtn.disabled = true;
	// elements.reconnectBtn.classList.add("bg-zinc-600");
	// elements.reconnectBtn.classList.remove("bg-blue-600", "hover:bg-blue-700");

	// elements.reconnectBtn.innerHTML = `
	// 	<i id="reconnectIcon" class="material-symbols-outlined text-4 animate-spin">refresh</i>
	// 	Connecting...
	// `;

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

const updateBoxList = (data = null) => {
	// console.log("==BOX LIST==")
	// const playersArray = processPlayerData(data);

	const selectedValue = elements.serverSelect.value;

	/* // redundant
	if (selectedValue == "default") {
		Object.entries(SIGNAL_BOXES).forEach(([box, { name }]) => {
			elements.map.getElementById(box)?.setAttribute("fill", "white");
		});
	}
	*/

	let occupiedBoxes = new Set();
	let trainCount = 0;
	let mannedBoxCount = 0;

	let leaderboardPlayerIDs = Object.values(state.leaderboardData.leaderboard).map((x) => x.id).flat();
	leaderboardPlayerIDs.push("85133710"); // TODO remove testing

	if (selectedValue != "default") {
		state.serverData[selectedValue].players.forEach((player) => {
			// for each player in our selected server:
			// 1. check if a player is driving a train
			// 2. check if a player is within proximity of a signal box
			// sconsole.log(player);

			player.trainData ? trainCount++ : null; // if train data exists traincount++			

			Object.entries(SIGNAL_BOXES).forEach(([box, { name, x, y, rad }]) => {
				const distance = Math.sqrt(
					(player.position.x - x) ** 2 + (player.position.y - y) ** 2
				);
				if (distance < rad) {
					const formattedusername = `${leaderboardPlayerIDs.includes(player.userId.toString()) ? "<span style=\"color: red\">" + player.username + "</span>" : player.username}`;
					// console.log(`Player ${player.username} is in box ${name}`);
					if (occupiedBoxes[box]) {
						(occupiedBoxes[box] += ` <i>and</i> ` + formattedusername);
					}
					else {
						occupiedBoxes[box] = formattedusername;
						mannedBoxCount++;
						state.lastSeenOccupiedBox[box] = Date.now();
					}
				}
			});
		});
	}

	// push data to page
	let html = `<tr><td style="width:40%">Box</td><td>Status</td><td style="width:50%">Player</td></tr>`;
	Object.entries(SIGNAL_BOXES).forEach(([box, { name }]) => {
		// table:
		const OCCUPY_TIME = 60000; // ms for a box to be considered occupied. 1 min
		let rowColor = "red";
		if (occupiedBoxes[box]) {
			rowColor = "forestgreen"
		}
		else if(Date.now() - state.lastSeenOccupiedBox[box] < OCCUPY_TIME) {
			rowColor = "yellow"
		}

		html += `<tr>
		<td>[${box}] ${name}</td>
		<td><svg height=1em style="float:left" viewBox="0 0 2 2"><ellipse cx="1" cy="1" rx="0.8" ry="0.8" fill="${rowColor}" stroke="white" stroke-width="0.4" /></svg>
		</td><td>${occupiedBoxes[box] || "<div style='color: #888;'>Empty</div>"}</td>
		</tr>`;

		// update map:
		elements.map.getElementById(box)?.setAttribute("fill", rowColor);
	});
	elements.boxList.innerHTML = html;

	elements.serverStats.innerHTML = `<tr><td style="width:50%">Trains: ${trainCount}</td><td style="width:50%">Manned Boxes: ${mannedBoxCount} / 13</td></tr>`;


};

const updateServerList = (data = null) => {
	const currentServers = Object.keys(state.serverData);
	const existingServers = Array.from(elements.serverSelect.options)
		.slice(1)
		.map((opt) => opt.value);

	// const playersArray = processPlayerData(data);

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
	if (state.currentServer != "default") {
		localStorage.setItem("DD_LASTSERVER", state.currentServer);
	}
});

const getLeaderboard = async () => {
	const CACHE_DURATION = 43200; // 12 hours in seconds
	let leaderboardCacheDate = JSON.parse(localStorage.getItem("DD_LEADERBOARD"))?.lastUpdated;
	if (!leaderboardCacheDate || (Date.now() / 1000 - leaderboardCacheDate) > CACHE_DURATION) {
		// leaderboard does not exist or is out of date. 
		// 1. get data, 2. update state, 3. store in localstorage
		// leaderboardData = await fetch("https://kairi.cat/databases/leaderboard");

		// TODO: API returns "lastUpdated" key, but don't trust. if they don't get data for a while we slam them every time...
		//  keep our own cache time?
		console.log("Fetching leaderboard...");
		try {
			const leaderboardDataRaw = await fetch("https://kairi.cat/databases/leaderboard").then(x => x.text());
			localStorage.setItem("DD_LEADERBOARD", leaderboardDataRaw);
		} catch (err) {
			console.error("Error fetching leaderboard data", err);
		}

	}
	state.leaderboardData = JSON.parse(localStorage.getItem("DD_LEADERBOARD")) || {};
};

const start = () => {
	elements.serverSelect.innerHTML =
		'<option value="default">Select Server</option>';
	createWebSocket();
	getLeaderboard();
};

start();