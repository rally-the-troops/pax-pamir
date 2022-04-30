"use strict";

// TODO: layout pieces on map
// TODO: check all card data

// TODO: safe house passive

// TODO: log helpers - piece name (army/road/tribe color/coalition)
// TODO: log helpers - card name (number, name, and court or market location)

let cards = require("./cards.js");

const Afghan = 'Afghan';
const British = 'British';
const Russian = 'Russian';

const Political = 'Political';
const Intelligence = 'Intelligence';
const Economic = 'Economic';
const Military = 'Military';

const Persia = 201;
const Transcaspia = 202;
const Herat = 203;
const Kabul = 204;
const Kandahar = 205;
const Punjab = 206;

const Persia_Transcaspia = 301;
const Persia_Herat = 302;
const Transcaspia_Herat = 303;
const Transcaspia_Kabul = 304;
const Herat_Kabul = 305;
const Herat_Kandahar = 306;
const Kabul_Kandahar = 307;
const Kabul_Punjab = 308;
const Kandahar_Punjab = 309;

const Gift = 400;
const Safehouse = 500;

const first_region = 201;
const last_region = 206;

const PUBLIC_WITHDRAWAL = 111;

const player_names = [
	"Gray",
	"Blue",
	"Tan",
	"Red",
	"Black",
];

const player_index = Object.fromEntries(Object.entries(player_names).map(([k,v])=>[v,k|0]));

const region_names = {
	[Persia]: "Persia",
	[Transcaspia]: "Transcaspia",
	[Herat]: "Herat",
	[Kabul]: "Kabul",
	[Kandahar]: "Kandahar",
	[Punjab]: "Punjab",
};

const region_index = {
	"Persia": Persia,
	"Transcaspia": Transcaspia,
	"Herat": Herat,
	"Kabul": Kabul,
	"Kandahar": Kandahar,
	"Punjab": Punjab,
};

cards.forEach(card => {
	if (card) {
		card.region = region_index[card.region];
		if (card.name === 'EVENT')
			card.name = card.if_discarded + " / " + card.if_purchased;
	}
});

const border_names = {
	[Persia_Transcaspia]: "Persia/Transcaspia",
	[Persia_Herat]: "Persia/Herat",
	[Transcaspia_Herat]: "Transcaspia/Herat",
	[Transcaspia_Kabul]: "Transcaspia/Kabul",
	[Herat_Kabul]: "Herat/Kabul",
	[Herat_Kandahar]: "Herat/Kandahar",
	[Kabul_Kandahar]: "Kabul/Kandahar",
	[Kabul_Punjab]: "Kabul/Punjab",
	[Kandahar_Punjab]: "Kandahar/Punjab",
}

const borders = {
	[Transcaspia]: [ Persia_Transcaspia, Transcaspia_Herat, Transcaspia_Kabul ],
	[Kabul]: [ Transcaspia_Kabul, Herat_Kabul, Kabul_Kandahar, Kabul_Punjab ],
	[Punjab]: [ Kabul_Punjab, Kandahar_Punjab ],
	[Persia]: [ Persia_Transcaspia, Persia_Herat ],
	[Herat]: [ Transcaspia_Herat, Persia_Herat, Herat_Kabul, Herat_Kandahar ],
	[Kandahar]: [ Kabul_Kandahar, Herat_Kandahar, Kandahar_Punjab ],
}

const roads = {
	[Transcaspia]: [ Persia, Herat, Kabul ],
	[Kabul]: [ Transcaspia, Herat, Kandahar, Punjab ],
	[Punjab]: [ Kabul, Kandahar ],
	[Persia]: [ Transcaspia, Herat ],
	[Herat]: [ Transcaspia, Persia, Kabul, Kandahar ],
	[Kandahar]: [ Kabul, Herat, Punjab ],
}

function is_dominance_check(c) {
	return c >= 101 && c <= 104;
}

function is_event_card(c) {
	return c > 100;
}

let game = null;
let player = null;
let view = null;

let states = {};

const scenario_player_count = { "2P": 2, "3P": 3, "4P": 4, "5P": 5 }

exports.scenarios = [ "3P", "4P", "5P", "2P" ];

exports.roles = function (scenario) {
	switch (scenario) {
	case "2P": return player_names.slice(0, 2);
	case "3P": return player_names.slice(0, 3);
	case "4P": return player_names.slice(0, 4);
	case "5P": return player_names.slice(0, 5);
	}
}

exports.ready = function (scenario, options, players) {
	switch (scenario) {
	case "2P": return players.length === 2;
	case "3P": return players.length === 3;
	case "4P": return players.length === 4;
	case "5P": return players.length === 5;
	}
}

function random(n) {
	return ((game.seed = game.seed * 69621 % 0x7fffffff) / 0x7fffffff) * n | 0;
}

function shuffle(deck) {
	for (let i = deck.length - 1; i > 0; --i) {
		let j = random(i + 1);
		let tmp = deck[j];
		deck[j] = deck[i];
		deck[i] = tmp;
	}
}

function remove_from_array(array, item) {
	let i = array.indexOf(item);
	if (i >= 0)
		array.splice(i, 1);
}

function set_active(new_active) {
	game.active = new_active;
	update_aliases();
}

function update_aliases() {
	player = game.players[game.active];
}

function find_card_in_market(c) {
	for (let row = 0; row < 2; ++row)
		for (let col = 0; col < 6; ++col)
			if (c === game.market_cards[row][col])
				return [row, col];
	return null;
}

function find_card_in_court(c) {
	for (let p = 0; p < game.players.length; ++p) {
		let court = game.players[p].court;
		for (let i = 0; i < court.length; ++i)
			if (court[i] === c)
				return p;
	}
	return -1;
}

function next_player(current) {
	return (current + 1) % game.players.length;
}

function a_or_an(s) {
	let x = s[0];
	switch (s[0]) {
	case 'A': case 'a':
	case 'O': case 'o':
	case 'E': case 'e':
	case 'U': case 'u':
	case 'I': case 'i':
		return "an " + s;
	}
	return "a " + s;
}

function logbr() {
	if (game.log.length > 0 && game.log[game.log.length-1] !== "")
		game.log.push("");
}

function log(msg) {
	game.log.push(msg);
}

function clear_undo() {
	game.undo = [];
}

function push_undo() {
	game.undo.push(JSON.stringify(game, (k,v) => {
		if (k === 'undo') return 0;
		if (k === 'log') return v.length;
		return v;
	}));
}

function pop_undo() {
	let save_undo = game.undo;
	let save_log = game.log;
	game = JSON.parse(save_undo.pop());
	game.undo = save_undo;
	save_log.length = game.log;
	game.log = save_log;
}

function gen_action(action, argument=undefined) {
	if (argument !== undefined) {
		if (!(action in view.actions)) {
			view.actions[action] = [ argument ];
		} else {
			if (!view.actions[action].includes(argument))
				view.actions[action].push(argument);
		}
	} else {
		view.actions[action] = 1;
	}
}

// STATE QUERIES

function active_has_court_card(c) {
	let court = player.court;
	for (let i = 0; i < court.length; ++i)
		if (court[i] === c)
			return true;
	return false;
}

function player_has_court_card(p, c) {
	let court = game.players[p].court;
	for (let i = 0; i < court.length; ++i)
		if (court[i] === c)
			return true;
	return false;
}

function any_player_has_court_card(p, c) {
	for (let p = 0; p < game.players.length; ++p) {
		let court = game.players[p].court;
		for (let i = 0; i < court.length; ++i)
			if (court[i] === c)
				return true;
	}
	return false;
}

function active_has_russian_influence() { return active_has_court_card(70); }
function active_has_persian_influence() { return active_has_court_card(68); }
function active_has_herat_influence() { return active_has_court_card(66); }
function active_has_claim_of_ancient_lineage() { return active_has_court_card(5); }
function active_has_indian_supplies() { return active_has_court_card(51); }
function active_has_well_connected() { return active_has_court_card(56); }
function active_has_strange_bedfellows() { return active_has_court_card(21); }
function active_has_infrastructure() { return active_has_court_card(78); }
function active_has_civil_service_reforms() { return active_has_court_card(24); }
function active_has_charismatic_courtiers() { return active_has_court_card(42); }
function active_has_blackmail_kandahar() { return active_has_court_card(43); }
function active_has_blackmail_herat() { return active_has_court_card(54); }

function player_has_bodyguards(p) { return player_has_court_card(p, 15) || player_has_court_card(p, 83); }
function player_has_indispensable_advisors(p) { return player_has_court_card(p, 1); }
function player_has_citadel_in_kabul(p) { return player_has_court_card(p, 17); }
function player_has_citadel_in_transcaspia(p) { return player_has_court_card(p, 97); }

function any_player_has_insurrection(p) { return any_player_has_court_card(p, 3); }

function player_has_citadel(p, r) {
	if (r === Kabul) return player_has_citadel_in_kabul(p);
	if (r === Transcaspia) return player_has_citadel_in_transcaspia(p);
	return false;
}

function player_coalition_blocks(p) {
	switch (game.players[p].loyalty) {
	case Afghan: return 0;
	case British: return 12;
	case Russian: return 24;
	}
}

function active_coalition_blocks() {
	switch (player.loyalty) {
	case Afghan: return 0;
	case British: return 12;
	case Russian: return 24;
	}
}

function player_cylinders(p) {
	return 36 + p * 10;
}

function active_cylinders() {
	return 36 + game.active * 10;
}

function active_gifts() {
	let x = active_cylinders();
	let n = 0;
	for (let i = x; i < x + 10; ++i)
		if (game.pieces[i] === Gift)
			++n;
	return n;
}

function gift_cost() {
	return 2 * active_gifts() + 2;
}

function ruler_of_region(r) {
	let ruler = -1;

	let n_afghan = 0;
	let n_british = 0;
	let n_russian = 0;
	for (let i = 0; i < 12; ++i) {
		if (game.pieces[i] === r)
			n_afghan ++;
		if (game.pieces[i+12] === r)
			n_british ++;
		if (game.pieces[i+24] === r)
			n_russian ++;
	}

	let max_ruling = Math.max(n_afghan, n_british, n_russian);

	for (let p = 0; p < game.players.length; ++p) {
		let n_tribes = 0;
		let x = player_cylinders(p);
		for (let i = x; i < x + 10; ++i)
			if (game.pieces[i] === r)
				n_tribes++;

		let n_ruling = n_tribes;
		if (game.players[p].loyalty === Afghan)
			n_ruling += n_afghan;
		if (game.players[p].loyalty === British)
			n_ruling += n_british;
		if (game.players[p].loyalty === Russian)
			n_ruling += n_russian;

		if (n_ruling === max_ruling) {
			ruler = -1;
		} else if (n_ruling > max_ruling) {
			max_ruling = n_ruling;
			if (n_tribes > 0)
				ruler = p;
			else
				ruler = -1;
		}
	}

	return ruler;
}

function player_rules_region(p, r) {
	return ruler_of_region(r) === p;
}

function active_rules_region(r) {
	return player_rules_region(game.active, r);
}

function player_rules_any_region(p) {
	for (let r = first_region; r <= last_region; ++r)
		if (player_rules_region(p, r))
			return true;
	return false;
}

function active_rules_any_region() {
	return player_rules_any_region(game.active);
}

function active_has_spy() {
	let x = active_cylinders();
	for (let i = x; i < x + 10; ++i)
		if (game.pieces[i] >= 1 && game.pieces[i] <= 100)
			return true;
	return false;
}

function card_has_no_spies(c) {
	for (let p = 0; p < game.players.length; ++p) {
		let x = player_cylinders(p);
		for (let i = x; i < x + 10; ++i)
			if (game.pieces[i] === c)
				return false;
	}
	return true;
}

function market_cost(col, c) {
	if (col === 0)
		return 0;
	if (cards[c].patriot === Russian && active_has_russian_influence())
		return 0;
	if (cards[c].region === Persia && active_has_persian_influence())
		return 0;
	if (cards[c].region === Herat && active_has_herat_influence())
		return 0;
	if (game.favored === Military)
		return 2 * col;
	return col;
}

function is_favored_suit(c) {
	if (cards[c].suit === game.favored)
		return true;
	if (player.events.new_tactics && cards[c].suit === Military)
		return true;
	if (c === 91) return true; // Savvy Operator
	if (c === 99) return true; // Irregulars
}

function rightmost_card(row, i) {
	while (i >= 0 && game.market_cards[row][i] === 0)
		--i;
	return i;
}

function pay_action_cost(count) {
	log(`Paid ${count} rupees.`);
	player.coins -= count;
	let ra = rightmost_card(0, 5);
	let rb = rightmost_card(1, 5);
	for (let i = 0; i < count; i += 2) {
		if (ra >= 0) game.market_coins[0][ra] ++;
		if (rb >= 0) game.market_coins[1][rb] ++;
		ra = rightmost_card(0, ra-1);
		rb = rightmost_card(1, rb-1);
	}
	public_withdrawal();
}

function remove_all_tribes_and_armies(where) {
	for (let i = 0; i < game.pieces.length; ++i)
		if (game.pieces[i] === where)
			game.pieces[i] = 0;
}

function player_with_most_spies(c) {
	let who = -1;
	let max_spies = 0;
	for (let p = 0; p < game.players.length; ++p) {
		let n_spies = count_player_cylinders(p, c);
		if (n_spies === max_spies) {
			who = -1;
		} else if (n_spies > max_spies) {
			max_spies = n_spies;
			who = p;
		}
	}
	return who;
}

function select_available_cylinder() {
	let x = active_cylinders();
	for (let i = x; i < x + 10; ++i)
		if (game.pieces[i] === 0)
			return i;
	return -1;
}

function gen_select_cylinder() {
	let x = active_cylinders();
	for (let i = x; i < x + 10; ++i)
		if (!game.used_pieces.includes(i))
			gen_action('piece', i);
}

function gen_select_spy_to_move() {
	let x = active_cylinders();
	for (let i = x; i < x + 10; ++i)
		if (game.pieces[i] > 0 && game.pieces[i] <= 100)
			gen_action('piece', i);
}

function gen_select_tribe_to_move() {
	let x = active_cylinders();
	for (let i = x; i < x + 10; ++i)
		if (game.pieces[i] >= first_region && game.pieces[i] <= last_region)
			gen_action('piece', i);
}

function select_available_block() {
	let b = active_coalition_blocks();
	for (let i = b; i < b + 12; ++i)
		if (game.pieces[i] === 0)
			return i;
	return -1;
}

function gen_select_block() {
	let b = active_coalition_blocks();
	for (let i = b; i < b + 12; ++i)
		if (!game.used_pieces.includes(i))
			gen_action('piece', i);
}

function gen_select_army_to_move() {
	// TODO: only select armies in regions that can move
	let b = active_coalition_blocks();
	for (let i = b; i < b + 12; ++i)
		if (game.pieces[i] >= first_region && game.pieces[i] <= last_region)
			gen_action('piece', i);
}

// DISCARD COURT CARD

function discard_court_card(c) {
	let pidx = -1;

	// Remove card from court
	for (let p = 0; p < game.players.length; ++p) {
		let i = game.players[p].court.indexOf(c);
		if (i >= 0) {
			game.players[p].court.splice(i, 1);
			pidx = p;
			break;
		}
	}

	log(`${player_names[pidx]} discarded ${cards[c].name}.`);

	// Return all spies on card
	for (let p = 0; p < game.players.length; ++p) {
		let x = player_cylinders(p);
		for (let i = x; i < x + 10; ++i)
			if (game.pieces[i] === c)
				game.pieces[i] = 0;
	}

	// Return rupees for leverage
	if (cards[c].leveraged) {
		log(`${player_names[pidx]} returned leverage.`);
		game.players[pidx].coins -= 2;
	}

	check_court_overthrow(pidx, cards[c].region);
}

// CHANGE LOYALTY

function change_loyalty(new_loyalty) {
	player.loyalty = new_loyalty;

	log(`${player_names[game.active]} switches loyalty to ${player.loyalty}.`);

	for (let i = 0; i < player.court.length;) {
		let c = player.court[i];
		let card = cards[c];
		if (card.patriot && card.patriot !== new_loyalty) {
			discard_court_card(c);
		} else {
			++i;
		}
	}

	let x = active_cylinders();
	for (let i = x; i < x + 10; ++i)
		if (game.pieces[i] === Gift)
			game.pieces[i] = 0;

	player.prizes = 0;
}

// RETURN LEVERAGE

function check_leverage() {
	let first = game.phasing;
	for (let p = first; p < game.players.length; ++p)
		if (check_player_leverage(p))
			return;
	for (let p = 0; p < first; ++p)
		if (check_player_leverage(p))
			return;
	resume_actions();
}

function check_player_leverage(p) {
	if (game.players[p].coins < 0) {
		if (game.players[p].hand.length + game.players[p].court.length === 0) {
			game.players[p].coins = 0;
		} else {
			if (game.active !== p)
				clear_undo();
			set_active(p);
			game.state = 'leverage';
			return true;
		}
	}
	return false;
}

states.leverage = {
	prompt() {
		if (player.coins < 0) {
			view.prompt = `Discard cards from your hand or court to pay for leverage.`;
			for (let i = 0; i < player.hand.length; ++i)
				gen_action('card', player.hand[i]);
			for (let i = 0; i < player.court.length; ++i)
				gen_action('card', player.court[i]);
		} else {
			view.prompt = `Discard cards from your hand or court to pay for leverage \u2014 done.`;
			gen_action('next');
		}
	},
	card(c) {
		push_undo();
		player.coins ++;
		if (player.hand.includes(c))
			remove_from_array(player.hand, c);
		else
			discard_court_card(c);
		if (player.hand.length + player.court.length === 0)
			player.coins = 0;
	},
	next() {
		clear_undo();
		check_leverage();
	}
}

// OVERTHROW

function check_court_overthrow(p, r) {
	let court = game.players[p].court;
	let x = player_cylinders(p);

	let nc = 0;
	for (let i = 0; i < court.length; ++i)
		if (cards[court[i]].region === r)
			++nc;

	let nt = 0;
	for (let i = x; i < x + 10; ++i)
		if (game.pieces[i] === r)
			++nt;

	if (nc === 0 && nt > 0) {
		log(`${player_names[p]} is overthrown in ${region_names[r]}.`);
		for (let i = x; i < x + 10; ++i)
			if (game.pieces[i] === r)
				game.pieces[i] = 0;
	}
}

function check_region_overthrow(p, r) {
	let court = game.players[p].court;
	let x = player_cylinders(p);

	let nc = 0;
	for (let i = 0; i < court.length; ++i)
		if (cards[court[i]].region === r)
			++nc;

	let nt = 0;
	for (let i = x; i < x + 10; ++i)
		if (game.pieces[i] === r)
			++nt;

	if (nt === 0 && nc > 0) {
		log(`${player_names[p]} is overthrown in ${region_names[r]}.`);
		for (let i = 0; i < court.length;) {
			if (cards[court[i]].region === r)
				discard_court_card(court[i]);
			else
				++i;
		}
	}
}

// BRIBES

states.bribe = {
	prompt() {
		let p = ruler_of_region(cards[game.card].region);
		view.prompt = `Must pay ${game.count} rupee bribe to ${player_names[p]}.`;
		if (player.coins - game.reserve >= game.count)
			gen_action('pay');
		gen_action('beg');
		if (player.events.courtly_manners)
			gen_action('courtly_manners');
		if (game.undo.length === 0)
			gen_action('refuse');
	},
	courtly_manners() {
		log(`${player_names[p]} chooses not to pay bribe.`);
		end_bribe();
	},
	pay() {
		let p = ruler_of_region(cards[game.card].region);
		game.players[p].coins += game.count;
		game.players[game.active].coins -= game.count;
		end_bribe();
	},
	beg() {
		clear_undo();
		let p = ruler_of_region(cards[game.card].region);
		game.state = 'waive';
		set_active(p);
	},
	refuse() {
		game.card = 0;
		game.where = 0;
		resume_actions();
	},
}

states.waive = {
	prompt() {
		if (typeof game.where === 'string')
			view.prompt = `${player_names[game.phasing]} asks you to waive the bribe to use ${cards[game.card].name} to ${game.where}.`;
		else
			view.prompt = `${player_names[game.phasing]} asks you to waive the bribe to play ${cards[game.card].name}.`;
		let max_cost = Math.min(game.players[game.phasing].coins - game.reserve, game.count);
		gen_action('waive');
		for (let i = 1; i < max_cost; ++i)
			gen_action('offer_' + i);
		gen_action('refuse');
	},
	waive() {
		log(`${player_names[game.active]} waived the bribe.`);
		set_active(game.phasing);
		end_bribe();
	},
	offer_1() { do_offer(1); },
	offer_2() { do_offer(2); },
	offer_3() { do_offer(3); },
	offer_4() { do_offer(4); },
	offer_5() { do_offer(5); },
	offer_6() { do_offer(6); },
	offer_7() { do_offer(7); },
	offer_8() { do_offer(8); },
	offer_9() { do_offer(9); },
	refuse() {
		log(`${player_names[game.active]} refused to waive the bribe.`);
		game.state = 'bribe'
		set_active(game.phasing);
	},
}

function do_offer(n) {
	log(`${player_names[game.active]} reduced the bribe to ${n}.`);
	game.count = 1;
	game.state = 'bribe';
	set_active(game.phasing);
}

function end_bribe() {
	if (typeof game.where === 'string')
		do_card_action_2();
	else
		do_play_2();
}

// STARTING LOYALTY

states.loyalty = {
	prompt() {
		view.prompt = `Choose your loyalty \u2014 Afghan, British, or Russian.`;
		gen_action('loyalty_afghan');
		gen_action('loyalty_british');
		gen_action('loyalty_russian');
	},
	loyalty_afghan() {
		set_starting_loyalty(Afghan);
	},
	loyalty_british() {
		set_starting_loyalty(British);
	},
	loyalty_russian() {
		set_starting_loyalty(Russian);
	},
}

function set_starting_loyalty(loyalty) {
	log(`${player_names[game.active]} pledged ${loyalty} loyalty.`);
	player.loyalty = loyalty;
	let next = next_player(game.active);
	if (game.players[next].loyalty)
		goto_actions();
	else
		set_active(next);
}

// ACTION PHASE

function goto_actions() {
	game.phasing = game.active;
	game.actions = 2;
	game.used_cards = []; // track cards that have been used
	game.used_pieces = [];
	game.selected = -1;
	game.where = 0;
	logbr();
	log(`.turn ${player_names[game.phasing]}`);
	logbr();

	let bmh = active_can_blackmail(Herat);
	let bmk = active_can_blackmail(Kandahar);
	if (bmh || bmk) {
		game.state = 'blackmail';
		game.where = (bmh && bmk) ? -1 : (bmh ? Herat : Kandahar);
		game.selected = select_available_cylinder();
	} else {
		resume_actions();
	}
}

function end_action() {
	check_leverage();
}

function resume_actions() {
	set_active(game.phasing);
	game.selected = -1;
	game.where = 0;
	game.state = 'actions';
}

function goto_next_player() {
	clear_undo();
	game.phasing = next_player(game.phasing);
	set_active(game.phasing);
	goto_actions();
}

states.actions = {
	prompt() {
		if (game.actions === 2)
			view.prompt = `You have two actions.`;
		else if (game.actions === 1)
			view.prompt = `You have one action.`;
		else
			view.prompt = `You have no more actions.`;

		// Pass / End turn
		if (game.actions > 0) {
			gen_action('pass');
		} else {
			gen_action('next');
		}

		// Purchase
		if (game.actions > 0) {
			for (let row = 0; row < 2; ++row) {
				for (let col = 0; col < 6; ++col) {
					let c = game.market_cards[row][col];
					if (c && market_cost(col, c) <= player.coins && !game.used_cards.includes(c) && c !== PUBLIC_WITHDRAWAL)
						gen_action('purchase', c);
				}
			}
		}

		// Play
		if (game.actions > 0) {
			for (let i = 0; i < player.hand.length; ++i) {
				let c = player.hand[i];
				gen_action('play_left', c);
				gen_action('play_right', c);
			}
		}

		// Card-based actions
		for (let i = 0; i < player.court.length; ++i) {
			let c = player.court[i];
			let card = cards[c];
			if ((game.actions > 0 || is_favored_suit(c)) && !game.used_cards.includes(c)) {
				if (card.tax)
					gen_action('tax', c);
				if (card.gift && active_gifts() < 3 && player.coins >= gift_cost())
					gen_action('gift', c);
				if (card.build && player.coins >= 2 && active_rules_any_region())
					gen_action('build', c);
				if (card.move) // TODO: check if any moves are possible
					gen_action('move', c);
				if (card.betray && player.coins >= 2 && active_has_spy())
					gen_action('betray', c);
				if (card.battle)
					gen_action('battle', c);
			}
		}
	},

	purchase(c) {
		push_undo();
		logbr();

		let [row, col] = find_card_in_market(c);
		game.actions --;

		let cost = market_cost(col, c);
		let cost_per_card = cost / col;
		for (let i = 0; i < col; ++i) {
			if (game.market_cards[row][i] > 0) {
				game.market_coins[row][i] += cost_per_card;
				game.used_cards.push(game.market_cards[row][i]);
			} else {
				game.market_coins[1-row][i] += cost_per_card;
				game.used_cards.push(game.market_cards[1-row][i]);
			}
		}
		public_withdrawal();

		logbr();

		if (cost > 0) {
			if (cost > 1)
				log(`Paid ${cost} rupees.`);
			else
				log(`Paid ${cost} rupee.`);
			player.coins -= cost;
		}

		if (game.market_coins[row][col] > 0) {
			if (game.market_coins[row][col] > 1)
				log(`Took ${game.market_coins[row][col]} rupees.`);
			else
				log(`Took ${game.market_coins[row][col]} rupee.`);
			player.coins += game.market_coins[row][col];
		}

		game.market_coins[row][col] = 0;
		game.market_cards[row][col] = 0;

		if (is_dominance_check(c)) {
			log(`Purchased Dominance Check.`);
			do_dominance_check();
			resume_actions();
		} else if (is_event_card(c)) {
			log(`Purchased event ${cards[c].if_purchased}.`);
			events_if_purchased[cards[c].if_purchased]();
		} else {
			log(`Purchased ${cards[c].name}.`);
			player.hand.push(c);
			resume_actions();
		}
	},

	tax(c) { do_card_action_1(c, "Tax", 0); },
	gift(c) { do_card_action_1(c, "Gift", gift_cost()); },
	build(c) { do_card_action_1(c, "Build", 2); },
	move(c) { do_card_action_1(c, "Move", 0); },
	betray(c) { do_card_action_1(c, "Betray", 2); },
	battle(c) { do_card_action_1(c, "Battle", 0); },
	play_left(c) { do_play_1(c, 0); },
	play_right(c) { do_play_1(c, 1); },

	pass() {
		log(`Passed.`);
		goto_cleanup_court();
	},
	next() {
		goto_cleanup_court();
	},
}

// PLAY CARD

function do_play_1(c, side) {
	push_undo();
	game.card = c;
	game.where = side;
	if (!active_has_charismatic_courtiers() && !game.events.disregard_for_customs) {
		let ruler = ruler_of_region(cards[c].region);
		if (ruler >= 0 && ruler !== game.active) {
			game.state = 'bribe';
			game.count = count_player_cylinders(ruler, cards[c].region);
			game.reserve = 0;
			return;
		}
	}
	do_play_2();
}

function do_play_2() {
	let c = game.card;
	let side = game.where;
	game.actions --;
	logbr();
	log(`Played ${cards[c].name} (${region_names[cards[c].region]}).`);
	let idx = player.hand.indexOf(c);
	player.hand.splice(idx, 1);
	if (side)
		player.court.push(c);
	else
		player.court.unshift(c);
	goto_play_patriot();
}

function goto_play_patriot() {
	let card = cards[game.card];
	if (card.patriot && card.patriot !== player.loyalty)
		change_loyalty(card.patriot);
	goto_play_tribes();
}

function goto_play_tribes() {
	let card = cards[game.card];
	if (card.tribes) {
		game.count = card.tribes;
		game.state = 'place_tribe';
		game.where = card.region;
		game.selected = select_available_cylinder();
	} else {
		goto_play_roads();
	}
}

states.place_tribe = {
	inactive: "place tribe",
	prompt() {
		if (game.selected < 0) {
			view.prompt = `Place tribe in ${region_names[game.where]} \u2014 select a cylinder.`;
			gen_select_cylinder();
		} else {
			view.prompt = `Place tribe in ${region_names[game.where]}.`;
			gen_action('space', game.where);
		}
	},
	piece(x) {
		push_undo();
		game.selected = x;
	},
	space(s) {
		push_undo();
		log(`${player_names[game.active]} tribe to ${region_names[s]}.`);
		game.pieces[game.selected] = s;
		game.used_pieces.push(game.selected);
		game.selected = -1;
		if (--game.count === 0)
			goto_play_roads();
		else
			game.selected = select_available_cylinder();
	},
}

function goto_play_roads() {
	let card = cards[game.card];
	if (card.roads) {
		game.count = card.roads;
		game.state = 'place_road';
		game.where = card.region;
		game.selected = select_available_block();
	} else {
		goto_play_armies();
	}
}

states.place_road = {
	inactive: "place road",
	prompt() {
		if (game.selected < 0) {
			view.prompt = `Place ${player.loyalty} road in ${region_names[game.where]} \u2014 select a block to move.`;
			gen_select_block();
		} else {
			view.prompt = `Place ${player.loyalty} road in ${region_names[game.where]}.`;
			for (let s of borders[game.where])
				gen_action('space', s);
		}
	},
	piece(x) {
		push_undo();
		game.selected = x;
	},
	space(s) {
		push_undo();
		log(`${player.loyalty} road to ${border_names[s]}.`);
		game.pieces[game.selected] = s;
		game.used_pieces.push(game.selected);
		game.selected = -1;
		if (--game.count === 0)
			goto_play_armies();
		else
			game.selected = select_available_block();
	},
}

function goto_play_armies() {
	let card = cards[game.card];
	if (card.armies) {
		game.count = card.armies;
		game.state = 'place_army';
		game.where = card.region;
		game.selected = select_available_block();
	} else {
		goto_play_spies();
	}
}

states.place_army = {
	inactive: "place army",
	prompt() {
		if (game.selected < 0) {
			view.prompt = `Place ${player.loyalty} army in ${region_names[game.where]} \u2014 select a block to move.`;
			gen_select_block();
		} else {
			view.prompt = `Place ${player.loyalty} army in ${region_names[game.where]}.`;
			gen_action('space', game.where);
		}
	},
	piece(x) {
		push_undo();
		game.selected = x;
	},
	space(s) {
		push_undo();
		log(`${player.loyalty} army to ${region_names[s]}.`);
		game.pieces[game.selected] = s;
		game.used_pieces.push(game.selected);
		game.selected = -1;
		if (--game.count === 0)
			goto_play_spies();
		else
			game.selected = select_available_block();
	},
}

function goto_play_spies() {
	let card = cards[game.card];
	if (card.spies) {
		game.count = card.spies;
		game.state = 'place_spy';
		game.where = card.region;
		game.selected = select_available_cylinder();
	} else {
		goto_play_leveraged();
	}
}

states.place_spy = {
	inactive: "place spy",
	prompt() {
		if (game.selected < 0) {
			view.prompt = `Place spy on a court card in ${region_names[game.where]} \u2014 select a cylinder.`;
			gen_select_cylinder();
		} else {
			view.prompt = `Place spy on a court card in ${region_names[game.where]}.`;
			for (let p = 0; p < game.players.length; ++p) {
				let court = game.players[p].court;
				for (let i = 0; i < court.length; ++i) {
					let card = cards[court[i]];
					if (card.region === game.where) {
						gen_action('card', court[i]);
					}
				}
			}
		}
	},
	piece(x) {
		push_undo();
		game.selected = x;
	},
	card(c) {
		push_undo();
		log(`${player_names[game.active]} spy to ${cards[c].name}.`);
		game.pieces[game.selected] = c;
		game.used_pieces.push(game.selected);
		game.selected = -1;
		if (--game.count === 0)
			goto_play_leveraged();
		else
			game.selected = select_available_cylinder();
	},
}

function goto_play_leveraged() {
	let card = cards[game.card];
	if (card.leveraged) {
		log(`Leveraged 2 rupees.`);
		player.coins += 2;
	}
	goto_play_climate();
}

function goto_play_climate() {
	// TODO: manual click?
	let card = cards[game.card];
	if (card.climate && !game.events.pashtunwali_values) {
		log(`Favored suit to ${card.climate}.`);
		game.favored = card.climate;
	}
	end_action();
}

// CARD-BASED ACTION (COMMON)

const card_action_table = {
	Tax() {
		game.state = 'tax';
	},

	Gift() {
		pay_action_cost(gift_cost());
		game.selected = select_available_cylinder();
		if (game.selected < 0)
			game.state = 'gift';
		else
			do_gift();
	},

	Build() {
		game.count = Math.min(3, Math.floor(player.coins / 2));
		if (player.events.nation_building)
			game.count *= 2;
		game.selected = select_available_block();
		game.state = 'build';
	},

	Move() {
		game.selected = -1;
		game.state = 'move';
	},

	Betray() {
		pay_action_cost(2);
		game.state = 'betray';
	},

	Battle() {
		game.state = 'battle';
		game.where = 0;
	},
}

function do_card_action_1(c, what, reserve) {
	push_undo();
	game.card = c;
	game.where = what;
	if (!active_has_civil_service_reforms() && !game.events.disregard_for_customs) {
		let who = player_with_most_spies(c);
		if (who >= 0 && who !== game.active) {
			game.state = 'bribe';
			game.count = count_player_cylinders(who, c);
			game.reserve = reserve;
			return;
		}
	}
	do_card_action_2();
}

function do_card_action_2() {
	let c = game.card;
	let what = game.where;
	game.used_cards.push(c);
	if (!is_favored_suit(c))
		game.actions --;
	game.count = cards[c].rank;
	logbr();
	log(`Used ${cards[c].name} to ${what}.`);
	card_action_table[what]();
}

// CARD-BASED ACTION: TAX

function can_tax_player(active, p, claim) {
	let okay = claim;
	let shelter = 0;
	let court = game.players[p].court;
	for (let i = 0; i < court.length; ++i) {
		let c = court[i];
		if (!okay && player_rules_region(active, cards[c].region))
			okay = true;
		if (cards[c].suit === Economic)
			shelter += cards[c].rank;
	}
	return okay && game.players[p].coins > shelter;
}

function do_tax_player(p) {
	push_undo();
	log(`Taxed ${player_names[p]} player.`);
	game.players[p].coins --;
	player.coins ++;
	if (--game.count === 0)
		end_action();
}

states.tax = {
	prompt() {
		if (game.count === 1)
			view.prompt = `Tax \u2014 take up to ${game.count} rupee from market cards or players.`;
		else
			view.prompt = `Tax \u2014 take up to ${game.count} rupees from market cards or players.`;

		for (let row = 0; row < 2; ++row) {
			for (let col = 0; col < 6; ++col) {
				if (game.market_coins[row][col] > 0)
					gen_action('card', game.market_cards[row][col]);
			}
		}

		let claim = active_has_claim_of_ancient_lineage();
		for (let p = 0; p < game.players.length; ++p) {
			if (p !== game.active && can_tax_player(game.active, p, claim)) {
				gen_action('player_' + p);
				break;
			}
		}

		gen_action('pass');
	},
	pass() {
		push_undo();
		end_action();
	},
	card(c) {
		push_undo();
		let [row, col] = find_card_in_market(c);
		log(`Taxed ${cards[c].name}.`);
		game.market_coins[row][col] --;
		player.coins ++;
		if (--game.count === 0)
			end_action();
	},
	player_0() { do_tax_player(0); },
	player_1() { do_tax_player(1); },
	player_2() { do_tax_player(2); },
	player_3() { do_tax_player(3); },
	player_4() { do_tax_player(4); },
}

// CARD-BASED ACTION: GIFT

states.gift = {
	prompt() {
		view.prompt = `Select cylinder to use as Gift.`;
		gen_select_cylinder();
	},
	piece(x) {
		push_undo();
		game.selected = x;
		do_gift();
	},
}

function do_gift() {
	game.pieces[game.selected] = Gift;
	game.used_pieces.push(game.selected);
	end_action();
}

// CARD-BASED ACTION: BUILD

states.build = {
	prompt() {
		view.prompt = `Build up to ${game.count} armies and/or roads.`;
		gen_action('next');
		let must_pay = !player.events.nation_building || (game.count & 1) === 0;
		if (!must_pay || player.coins >= 2) {
			if (game.selected < 0) {
				gen_select_block();
			} else {
				for (let r = first_region; r <= last_region; ++r) {
					if (active_rules_region(r)) {
						gen_action('space', r);
						for (let s of borders[r])
							gen_action('space', s);
					}
				}
			}
		}
	},
	piece(x) {
		push_undo();
		game.selected = x;
	},
	space(s) {
		push_undo();

		let must_pay = !player.events.nation_building || (game.count & 1) === 0;
		if (must_pay)
			pay_action_cost(2);

		if (s <= last_region)
			log(`${player.loyalty} army to ${region_names[s]}.`);
		else
			log(`${player.loyalty} road to ${border_names[s]}.`);
		game.pieces[game.selected] = s;
		game.used_pieces.push(game.selected);
		game.selected = -1;
		--game.count;

		must_pay = !player.events.nation_building || (game.count & 1) === 0;
		if (game.count === 0 || (must_pay && player.coins < 2))
			end_build_action();
		else
			game.selected = select_available_block();
	},
	next() {
		push_undo();
		end_build_action();
	},
}

states.infrastructure = {
	prompt() {
		view.prompt = `Place an additional block.`;
		if (game.selected < 0) {
			gen_select_block();
		} else {
			for (let r = first_region; r <= last_region; ++r) {
				if (active_rules_region(r)) {
					gen_action('space', r);
					for (let s of borders[r])
						gen_action('space', s);
				}
			}
		}
	},
	piece(x) {
		push_undo();
		game.selected = x;
	},
	space(s) {
		push_undo();
		if (s <= last_region)
			log(`${player.loyalty} army to ${region_names[s]}.`);
		else
			log(`${player.loyalty} road to ${border_names[s]}.`);
		game.pieces[game.selected] = s;
		game.used_pieces.push(game.selected);
		game.selected = -1;
		end_action();
	},
}

function end_build_action() {
	if (active_has_infrastructure())
		game.state = 'infrastructure';
	else
		end_action();
}

// CARD-BASED ACTION: MOVE

function last_court_position() {
	let n = 0;
	for (let p = 0; p < game.players.length; ++p)
		n += game.players[p].court.length;
	return n - 1;
}

function court_card_from_position(y) {
	let x = 0;
	for (let p = 0; p < game.players.length; ++p) {
		let court = game.players[p].court;
		if (y < x + court.length)
			return court[y - x];
		x += court.length;
	}
	return 0;
}

function court_position_from_card(c) {
	let x = 0;
	for (let p = 0; p < game.players.length; ++p) {
		let court = game.players[p].court;
		for (let i = 0; i < court.length; ++i) {
			if (c === court[i])
				return x + i;
		}
		x += court.length;
	}
	return -1;
}

function find_border(a, b) {
	if (a > b) {
		let c = a; a = b; b = c;
	}
	if (a === Persia && b === Transcaspia) return Persia_Transcaspia;
	if (a === Persia && b === Herat) return Persia_Herat;
	if (a === Transcaspia && b === Herat) return Transcaspia_Herat;
	if (a === Transcaspia && b === Kabul) return Transcaspia_Kabul;
	if (a === Herat && b === Kabul) return Herat_Kabul;
	if (a === Herat && b === Kandahar) return Herat_Kandahar;
	if (a === Kabul && b === Kandahar) return Kabul_Kandahar;
	if (a === Kabul && b === Punjab) return Kabul_Punjab;
	if (a === Kandahar && b === Punjab) return Kandahar_Punjab;
	throw new Error(`bad border ${a} ${b}`);
}

function can_army_move_across_border(here, next) {
	let border = find_border(here, next);
	let b = active_coalition_blocks();
	for (let i = b; i < b + 12; ++i)
		if (game.pieces[i] === border)
			return true;
	return false;
}

states.move = {
	prompt() {
		if (game.selected >= 0) {
			let here = game.pieces[game.selected];

			// Spy on a court card
			if (here <= 100) {
				let c = here;
				here = court_position_from_card(here);
				view.prompt = `Move spy from ${cards[c].name}.`;

				let last = last_court_position();
				let prev = here > 0 ? here - 1 : last;
				let next = here < last ? here + 1 : 0;
				gen_action('card', court_card_from_position(prev));
				gen_action('card', court_card_from_position(next));

				if (active_has_well_connected()) {
					let pprev = prev > 0 ? prev - 1 : last;
					let nnext = next < last ? next + 1 : 0;
					gen_action('card', court_card_from_position(pprev));
					gen_action('card', court_card_from_position(nnext));
				}

				if (active_has_strange_bedfellows()) {
					let r = cards[c].region;
					for (let p = 0; p < game.players.length; ++p) {
						let court = game.players[p].court;
						for (let i = 0; i < court.length; ++i)
							if (cards[court[i]].region === r)
								gen_action('card', court[i]);
					}
				}
			}

			// Army or tribe in a region
			else {
				if (game.selected < 36)
					view.prompt = `Move ${player.loyalty} army from ${region_names[here]}.`;
				else
					view.prompt = `Move ${player_names[game.active]} tribe from ${region_names[here]}.`;
				let supplies = active_has_indian_supplies();
				for (let next of roads[here])
					if (supplies || can_army_move_across_border(here, next))
						gen_action('space', next);
			}
		} else {
			if (player.events.nationalism) {
				if (game.count === 1)
					view.prompt = `Move up to ${game.count} spy, army, or tribe \u2014 select a spy, army, or tribe to move.`;
				else
					view.prompt = `Move up to ${game.count} spies, armies, and/or tribes \u2014 select a spy, army, or tribe to move.`;
			} else {
				if (game.count === 1)
					view.prompt = `Move up to ${game.count} spy or army \u2014 select a spy or army to move.`;
				else
					view.prompt = `Move up to ${game.count} spies and/or armies \u2014 select a spy or army to move.`;
			}
			gen_action('next');
			gen_select_army_to_move();
			gen_select_spy_to_move();
			if (player.events.nationalism)
				gen_select_tribe_to_move();
		}
	},
	piece(x) {
		push_undo();
		game.selected = x;
	},
	card(c) {
		push_undo();
		let old = game.pieces[game.selected];
		log(`${player_names[game.active]} spy from ${cards[old].name} to ${cards[c].name}.`);
		game.pieces[game.selected] = c;
		game.selected = -1;
		if (--game.count === 0)
			end_action();
	},
	space(s) {
		push_undo();
		let old = game.pieces[game.selected];
		if (game.selected < 36)
			log(`${player.loyalty} army from ${region_names[old]} to ${region_names[s]}.`);
		else
			log(`${player_names[game.active]} tribe from ${region_names[old]} to ${region_names[s]}.`);
		game.pieces[game.selected] = s;
		game.selected = -1;
		if (--game.count === 0)
			end_action();
	},
	next() {
		push_undo();
		end_action();
	},
}

// CARD-BASED ACTION: BETRAY

states.betray = {
	prompt() {
		view.prompt = `Discard one court card where you have a spy.`;
		let x = active_cylinders();
		for (let i = x; i < x + 10; ++i) {
			if (game.pieces[i] > 0 && game.pieces[i] <= 100) {
				let c = game.pieces[i];
				let p = find_card_in_court(c);
				if (!player_has_bodyguards(p))
					gen_action('card', c);
			}
		}
	},
	card(c) {
		push_undo();
		discard_court_card(c);
		if (cards[c].prize) {
			game.card = c;
			game.state = 'accept_prize';
		} else {
			end_action();
		}
	},
}

states.accept_prize = {
	prompt() {
		view.prompt = `You may accept ${cards[game.card].name} as ${a_or_an(cards[game.card].prize)} prize.`;
		gen_action('accept');
		gen_action('refuse');
	},
	accept() {
		log(`${player_names[game.active]} took ${cards[game.card].name} as ${a_or_an(cards[game.card].prize)} prize.`);
		if (cards[game.card].prize !== player.loyalty)
			change_loyalty(cards[game.card].prize);
		player.prizes ++;
		end_action();
	},
	refuse() {
		end_action();
	},
}

// CARD-BASED ACTION: BATTLE

function gen_battle_blocks(where) {
	if (player.loyalty !== Afghan)
		for (let i = 0; i < 12; ++i)
			if (game.pieces[i] === where)
				gen_action('piece', i);
	if (player.loyalty !== British)
		for (let i = 12; i < 24; ++i)
			if (game.pieces[i] === where)
				gen_action('piece', i);
	if (player.loyalty !== Russian)
		for (let i = 24; i < 36; ++i)
			if (game.pieces[i] === where)
				gen_action('piece', i);
}

function count_active_spies_on_card(where) {
	let n = 0;
	let x = active_cylinders();
	for (let i = x; i < x + 10; ++i)
		if (game.pieces[i] === where)
			++n;
	return n;
}

function count_enemy_spies_on_card(where) {
	let n = 0;
	for (let p = 0; p < game.players.length; ++p) {
		if (p !== game.active) {
			let x = player_cylinders(p);
			for (let i = x; i < x + 10; ++i) {
				if (game.pieces[i] === where)
					++n;
			}
		}
	}
	return n;
}

function count_player_armies_in_region(p, where) {
	let n = 0;
	let b = player_coalition_blocks(p);
	for (let i = b; i < b + 12; ++i)
		if (game.pieces[i] === where)
			++n;
	return n;
}

function count_player_cylinders(p, r) {
	let x = player_cylinders(p);
	let n = 0;
	for (let i = x; i < x + 10; ++i)
		if (game.pieces[i] === r)
			++n;
	return n;
}

function count_active_armies_in_region(where) {
	return count_player_armies_in_region(game.active, where);
}

function count_enemy_blocks_on_border(where) {
	let n = 0;
	if (player.loyalty !== Afghan)
		for (let i = 0; i < 12; ++i)
			if (game.pieces[i] === where)
				++n;
	if (player.loyalty !== British)
		for (let i = 12; i < 24; ++i)
			if (game.pieces[i] === where)
				++n;
	if (player.loyalty !== Russian)
		for (let i = 24; i < 36; ++i)
			if (game.pieces[i] === where)
				++n;
	return n;
}

function count_enemy_tribes_and_blocks_in_region(where) {
	let n = 0;
	for (let p = 0; p < game.players.length; ++p) {
		if (game.players[p].loyalty !== player.loyalty) {
			let x = player_cylinders(p);
			for (let i = x; i < x + 10; ++i)
				if (game.pieces[i] === where)
					++n;
		}
	}
	if (player.loyalty !== Afghan)
		for (let i = 0; i < 12; ++i)
			if (game.pieces[i] === where)
				++n;
	if (player.loyalty !== British)
		for (let i = 12; i < 24; ++i)
			if (game.pieces[i] === where)
				++n;
	if (player.loyalty !== Russian)
		for (let i = 24; i < 36; ++i)
			if (game.pieces[i] === where)
				++n;
	for (let b of borders[where])
		n += count_enemy_blocks_on_border(b);
	return n;
}

function is_battle_card(where) {
	return count_active_spies_on_card(where) > 0 && count_enemy_spies_on_card(where) > 0;
}

function is_battle_region(where) {
	return count_active_armies_in_region(where) > 0 && count_enemy_tribes_and_blocks_in_region(where) > 0;
}

function piece_owner(x) {
	if (x < 12) return "Afghan";
	if (x < 24) return "British";
	if (x < 36) return "Russian";
	if (x < 36+10) return player_names[0];
	if (x < 36+20) return player_names[1];
	if (x < 36+30) return player_names[2];
	if (x < 36+40) return player_names[3];
	if (x < 36+50) return player_names[4];
	return "undefined";
}

states.battle = {
	prompt() {
		if (game.where <= 0) {
			view.prompt = `Start a battle in a single region or on a court card.`
			for (let p = 0; p < game.players.length; ++p) {
				let court = game.players[p].court;
				for (let i = 0; i < court.length; ++i) {
					if (is_battle_card(court[i]))
						gen_action('card', court[i]);
				}
			}
			for (let r = first_region; r <= last_region; ++r) {
				if (is_battle_region(r))
					gen_action('space', r);
			}
		} else {
			let where = game.where;
			if (where >= first_region && where <= last_region) {
				view.prompt = `Remove up to ${game.count} tribes, roads, or armies from ${region_names[where]}.`;
				gen_battle_blocks(where);
				for (let border of borders[where])
					gen_battle_blocks(border);
				for (let p = 0; p < game.players.length; ++p) {
					if (p !== game.active && game.players[p].loyalty !== player.loyalty && !player_has_citadel(p, where)) {
						let x = player_cylinders(p);
						for (let i = x; i < x + 10; ++i)
							if (game.pieces[i] === where)
								gen_action('piece', i);
					}
				}
			} else {
				view.prompt = `Remove up to ${game.count} spies on ${cards[where].name}.`;
				for (let p = 0; p < game.players.length; ++p) {
					if (p !== game.active && !player_has_indispensable_advisors(p)) {
						let x = player_cylinders(p);
						for (let i = 0; i < 10; ++i)
							if (game.pieces[i] === where)
								gen_action('piece', i);
					}
				}
			}
			gen_action('next');
		}
	},
	card(where) {
		push_undo();
		log(`${player_names[game.active]} starts battle on ${cards[where].name}.`);
		game.where = where;
		game.count = Math.min(game.count, count_active_spies_on_card(where));
	},
	space(s) {
		push_undo();
		log(`${player_names[game.active]} starts battle in ${region_names[s]}.`);
		game.where = s;
		game.count = Math.min(game.count, count_active_armies_in_region(s));
	},
	piece(x) {
		push_undo();
		let where = game.pieces[x];
		game.pieces[x] = 0;
		if (x < 36) {
			if (game.where >= first_region && game.where <= last_region)
				log(`Removed ${piece_owner(x)} army from ${region_names[where]}.`);
			else
				log(`Removed ${piece_owner(x)} road from ${border_names[where]}.`);
		} else {
			if (where <= 100) {
				log(`Removed ${piece_owner(x)} spy from ${cards[where].name}.`);
			} else {
				log(`Removed ${piece_owner(x)} tribe from ${region_names[where]}.`);
				let p = Math.floor((x - 36) / 10);
				check_region_overthrow(p, where);
			}
		}
		if (--game.count === 0)
			end_action();
	},
	next() {
		push_undo();
		end_action();
	}
}

// PASSIVE: BLACKMAIL

function active_can_blackmail(r) {
	if ((r === Herat && active_has_blackmail_herat()) || (r === Kandahar && active_has_blackmail_kandahar())) {
		for (let p = 0; p < game.players.length; ++p) {
			let court = game.players[p].court;
			for (let i = 0; i < court.length; ++i) {
				let c = court[i];
				if (cards[c].region === r && card_has_no_spies(c))
					return true;
			}
		}
	}
	return false;
}

states.blackmail = {
	prompt() {
		let bmh = game.where !== Kandahar && active_can_blackmail(Herat);
		let bmk = game.where !== Herat && active_can_blackmail(Kandahar);
		let msg = "";
		if (bmh && bmk)
			msg = "any Herat and/or Kandahar court card without a spy";
		else if (bmh)
			msg = "any Herat court card without a spy";
		else
			msg = "any Kandahar court card without a spy";
		if (game.selected < 0) {
			view.prompt = `Blackmail \u2014 select a spy to place on ${msg}.`;
			gen_select_cylinder();
		} else {
			let bmh = game.where !== Kandahar && active_can_blackmail(Herat);
			let bmk = game.where !== Herat && active_can_blackmail(Kandahar);
			view.prompt = `Blackmail \u2014 place a spy on ${msg}.`;
			for (let p = 0; p < game.players.length; ++p) {
				let court = game.players[p].court;
				for (let i = 0; i < court.length; ++i) {
					let c = court[i];
					if (bmh && cards[c].region === Herat && card_has_no_spies(c))
						gen_action('card', c);
					if (bmk && cards[c].region === Kandahar && card_has_no_spies(c))
						gen_action('card', c);
				}
			}
		}
		gen_action('pass');
	},
	piece(x) {
		push_undo();
		game.selected = x;
	},
	card(c) {
		push_undo();
		log(`${player_names[game.active]} blackmail spy to ${cards[c].name}.`);
		game.pieces[game.selected] = c;
		game.used_pieces.push(game.selected);
		if (game.where < 0) {
			game.where = (cards[c].region === Herat) ? Kandahar : Herat;
			game.selected = select_available_cylinder();
		} else {
			resume_actions();
		}
	},
	pass() {
		push_undo();
		resume_actions();
	},
}

// PASSIVE: SAFEHOUSE (TODO)

// CLEANUP

function player_court_size() {
	let stars = 3;
	for (let i = 0; i < player.court.length; ++i) {
		let c = player.court[i];
		if (cards[c].suit === Political)
			stars += cards[c].rank;
	}
	return stars;
}

function player_hand_size() {
	let stars = 2;
	for (let i = 0; i < player.court.length; ++i) {
		let c = player.court[i];
		if (cards[c].suit === Intelligence)
			stars += cards[c].rank;
	}
	return stars;
}

function goto_cleanup_court() {
	if (player.court.length > player_court_size()) {
		game.state = 'cleanup_court';
	} else {
		goto_cleanup_hand();
	}
}

states.cleanup_court = {
	inactive: "cleanup court",
	prompt() {
		let size = player_court_size();
		if (player.court.length <= size) {
			view.prompt = `Discard cards in your court until you are within your limit \u2014 done.`;
			gen_action('next');
		} else {
			view.prompt = `Discard cards in your court until you are within your limit (${size}).`;
			for (let i = 0; i < player.court.length; ++i)
				gen_action('card', player.court[i]);
		}
	},
	card(c) {
		push_undo();
		log(`${player_names[game.active]} discarded\n${cards[c].name} from their court.`);
		discard_court_card(c);
	},
	next() {
		push_undo();
		goto_cleanup_hand();
	}
}

function goto_cleanup_hand() {
	if (player.hand.length > player_hand_size()) {
		game.state = 'cleanup_hand';
	} else {
		goto_discard_events();
	}
}

states.cleanup_hand = {
	inactive: "cleanup hand",
	prompt() {
		let size = player_hand_size();
		if (player.hand.length <= size) {
			view.prompt = `Discard cards in your hand until you are within your limit \u2014 done.`;
			gen_action('next');
		} else {
			view.prompt = `Discard cards in your hand until you are within your limit (${size}).`;
			for (let i = 0; i < player.hand.length; ++i)
				gen_action('card', player.hand[i]);
		}
	},
	card(c) {
		push_undo();
		log(`${player_names[game.active]} discarded\n${cards[c].name} from their hand.`);
		remove_from_array(player.hand, c);
	},
	next() {
		goto_discard_events();
	}
}

function do_discard_event(row, c) {
	game.market_cards[row][0] = 0;
	logbr();
	log(`Discarded event\n${cards[c].if_discarded}.`);
	logbr();
	if (is_dominance_check(c)) {
		do_dominance_check();
		goto_discard_events();
	} else {
		events_if_discarded[cards[c].if_discarded](row);
	}
}

function goto_discard_events() {
	clear_undo();
	if (is_event_card(game.market_cards[0][0])) {
		do_discard_event(0, game.market_cards[0][0]);
	} else if (is_event_card(game.market_cards[1][0])) {
		do_discard_event(1, game.market_cards[1][0]);
	} else {
		goto_refill_market();
	}
}

function discard_instability_cards() {
	for (let row = 0; row < 2; ++row) {
		for (let col = 0; col < 6; ++col) {
			let c = game.market_cards[row][col];
			if (is_dominance_check(c))
				game.market_cards[row][col] = 0;
		}
	}
}

function goto_refill_market() {
	// Move all cards (and their rupees) to the left.
	for (let row = 0; row < 2; ++row) {
		let row_cards = game.market_cards[row];
		let row_coins = game.market_coins[row];
		for (let to = 0; to < 6; ++to) {
			if (row_cards[to] === 0) {
				for (let from = to + 1; from < 6; ++from) {
					if (row_cards[from] > 0) {
						row_cards[to] = row_cards[from];
						row_cards[from] = 0;
						row_coins[to] += row_coins[from];
						row_coins[from] = 0;
						break;
					}
				}
			}
		}
	}

	// Instability ...
	let instability = 0;
	for (let row = 0; row < 2; ++row) {
		for (let col = 0; col < 6; ++col) {
			let c = game.market_cards[row][col];
			if (is_dominance_check(c))
				++instability;
		}
	}

	// Fill with new cards from left (top row in each column first)
	for (let col = 0; col < 6; ++col) {
		for (let row = 0; row < 2; ++row) {
			if (game.deck.length > 0) {
				if (game.market_cards[row][col] === 0) {
					let c = game.deck.pop();
					game.market_cards[row][col] = c;
					if (instability > 0 && is_dominance_check(c)) {
						log(`Instability!`);
						discard_instability_cards();
						do_dominance_check();
						goto_refill_market();
					}
				}
			}
		}
	}

	goto_next_player();
}

// EVENTS: IF DISCARDED

const events_if_discarded = {

	"Military" () {
		game.favor = Military;
		goto_discard_events();
	},

	"Embarrassment of Riches" () {
		game.events.embarrassment_of_riches = 1;
		goto_discard_events();
	},

	"Disregard for Customs" () {
		game.events.disregard_for_customs = 1;
		goto_discard_events();
	},

	"Failure to Impress" () {
		for (let p = 0; p < game.players.length; ++p)
			game.players[p].prizes = 0;
		goto_discard_events();
	},

	"Riots in Punjab" () {
		remove_all_tribes_and_armies(Punjab);
		goto_discard_events();
	},

	"Riots in Herat" () {
		remove_all_tribes_and_armies(Herat);
		goto_discard_events();
	},

	"No effect" () {
		goto_discard_events();
	},

	"Riots in Kabul" () {
		remove_all_tribes_and_armies(Kabul);
		goto_discard_events();
	},

	"Riots in Persia" () {
		remove_all_tribes_and_armies(Persia);
		goto_discard_events();
	},

	"Confidence Failure" () {
		game.state = 'confidence_failure';
		if (player.hand.length === 0)
			next_confidence_failure();
	},

	"Intelligence" () {
		game.favored = Intelligence;
		goto_discard_events();
	},

	"Political" () {
		game.favored = Political;
		goto_discard_events();
	},

}

states.confidence_failure = {
	prompt() {
		view.prompt = "Confidence Failure \u2014 discard a card from your hand.";
		for (let i = 0; i < player.hand.length; ++i)
			gen_action('card', player.hand[i]);
	},
	card(c) {
		log(`${player_names[game.active]} discarded ${cards[c].name} from their hand.`);
		remove_from_array(player.hand, c);
		next_confidence_failure();
	},
}

function next_confidence_failure() {
	for (;;) {
		let next = next_player(game.active);
		if (next === game.phasing)
			return goto_discard_events();
		if (game.players[next].hand.length > 0)
			return set_active(next);
	}
}

// EVENTS: IF PURCHASED

const events_if_purchased = {

	"New Tactics" () {
		player.events.new_tactics = 1;
		end_action();
	},

	"Koh-i-noor Recovered" () {
		player.events.koh_i_noor = 1;
		end_action();
	},

	"Courtly Manners" () {
		player.events.courtly_manners = 1;
		end_action();
	},

	"Rumor" () {
		game.state = 'rumor';
	},

	"Conflict Fatigue" () {
		game.events.conflict_fatigue = 1;
		end_action();
	},

	"Nationalism" () {
		player.events.nationalism = 1;
		end_action();
	},

	"Public Withdrawal" () {
		throw new Error("cannot purchase");
	},

	"Nation Building" () {
		player.events.nation_building = 1;
		end_action();
	},

	"Backing of Persian Aristocracy" () {
		player.coins += 3;
		end_action();
	},

	"Other Persuasive Methods" () {
		game.state = 'other_persuasive_methods';
	},

	"Pashtunwali Values" () {
		game.state = 'pashtunwali_values';
	},

	"Rebuke" () {
		game.state = 'rebuke';
	},

}

// TODO: other_persuasive_methods
// TODO: pashtunwali_values
// TODO: rebuke

function public_withdrawal() {
	// Remove any money placed on card "Public Withdrawal" from the game.
	for (let row = 0; row < 2; ++row)
		for (let col = 0; col < 6; ++col)
			if (game.market_cards[row][col] === PUBLIC_WITHDRAWAL)
				game.market_coins[row][col] = 0;
}

states.rumor = {
	prompt() {
		view.prompt = `Rumor \u2014 choose a player.`;
		for (let p = 0; p < game.players.length; ++p)
			if (p !== game.active)
				gen_action('player_' + p);
	},
	player_0() { do_rumor(0); },
	player_1() { do_rumor(1); },
	player_2() { do_rumor(2); },
	player_3() { do_rumor(3); },
	player_4() { do_rumor(4); },
}

function do_rumor(p) {
	push_undo();
	log(`${player_names[game.active]} chose ${player_names[p]}.`);
	game.players[p].events.rumor = 1;
	end_action();
}

states.other_persuasive_methods = {
	prompt() {
		view.prompt = `Other Persuasive Methods \u2014 exchange your hand with another player.`;
		for (let p = 0; p < game.players.length; ++p)
			if (p !== game.active)
				gen_action('player_' + p);
	},
	player_0() { do_other_persuasive_methods(0); },
	player_1() { do_other_persuasive_methods(1); },
	player_2() { do_other_persuasive_methods(2); },
	player_3() { do_other_persuasive_methods(3); },
	player_4() { do_other_persuasive_methods(4); },
}

function do_other_persuasive_methods(p) {
	// TODO: clear_undo instead?
	push_undo();
	log(`${player_names[game.active]} exchanged hands with ${player_names[p]}.`);
	let swap = game.players[game.active].hand;
	game.players[game.active].hand = game.players[p].hand;
	game.players[p].hand = swap;
	end_action();
}

states.pashtunwali_values = {
	prompt() {
		view.prompt = `Pashtunwali Values \u2014 choose a suit to favor.`;
		gen_action('suit_political');
		gen_action('suit_intelligence');
		gen_action('suit_economic');
		gen_action('suit_military');
	},
	suit_political() { do_pashtunwali_values(Political); },
	suit_intelligence() { do_pashtunwali_values(Intelligence); },
	suit_economic() { do_pashtunwali_values(Economic); },
	suit_military() { do_pashtunwali_values(Military); },
}

function do_pashtunwali_values(suit) {
	log(`Favored suit to ${suit}.`);
	game.favored = suit;
	game.events.pashtunwali_values = 1;
	end_action();
}

states.rebuke = {
	prompt() {
		view.prompt = `Rebuke \u2014 remove all tribes and armies in a single region.`;
		for (let s = first_region; s <= last_region; ++s)
			// TODO: can pick empty region?
			gen_action('space', s);
	},
	space(s) {
		push_undo();
		log(`Removed all tribes and armies in ${region_names[s]}.`);
		remove_all_tribes_and_armies(s);
		end_action();
	},
}

// DOMINANCE CHECK

function count_cylinders_in_play(p) {
	let n = 0;
	let x = player_cylinders(p);
	for (let i = x; i < x + 10; ++i)
		if (game.pieces[i] > 0)
			++n;
	return n;
}

function count_influence_points(p) {
	let n = 1 + game.players[p].prizes;
	let x = player_cylinders(p);

	if (!game.events.embarrassment_of_riches) {
		let gv = game.players[p].events.koh_i_noor ? 2 : 1;
		for (let i = x; i < x + 10; ++i)
			if (game.pieces[i] === Gift)
				n += gv;
	}

	if (!game.players[p].events.rumor) {
		let court = game.players[p].court;
		for (let i = 0; i < court.length; ++i)
			if (cards[court[i]].patriot)
				++n;
	}

	return n;
}

function assign_vp(points, score, sorted) {
	const PLACE = [ "1st", "2nd", "3rd" ];
	let place = 0;
	sorted.sort((a,b) => b-a);
	while (points.length > 0 && sorted.length > 0) {
		let n = 0;
		for (let p = 0; p < game.players.length; ++p)
			if (score[p] === sorted[0])
				++n;
		let v = 0;
		for (let i = 0; i < n; ++i)
			v += points[i] | 0;
		v = Math.floor(v / n);
		let msg = `${PLACE[place]} place:`;
		for (let p = 0; p < game.players.length; ++p) {
			if (score[p] === sorted[0]) {
				msg += "\n" + player_names[p] + " scored " + v + " vp.";
				game.players[p].vp += v;
			}
		}
		log(msg);
		points = points.slice(n);
		sorted = sorted.slice(n);
		place += n;
	}
}

function is_final_dominance_check() {
	for (let row = 0; row < 2; ++row)
		for (let col = 0; col < 6; ++col)
			if (is_dominance_check(game.market_cards[row][col]))
				return false;
	for (let i = 0; i < game.deck.length; ++i)
		if (is_dominance_check(game.deck[i]))
			return false;
	return true;
}

function do_dominance_check() {
	let n_afghan = 0;
	let n_british = 0;
	let n_russian = 0;
	let success = null;

	for (let i = 0; i < 12; ++i) {
		if (game.pieces[i] > 0)
			n_afghan ++;
		if (game.pieces[i+12] > 0)
			n_british ++;
		if (game.pieces[i+24] > 0)
			n_russian ++;
	}

	let limit = game.events.conflict_fatigue ? 2 : 4;
	if (n_afghan >= n_british+limit && n_afghan >= n_russian+limit)
		success = Afghan;
	else if (n_british >= n_afghan+limit && n_british >= n_russian+limit)
		success = British;
	else if (n_russian >= n_british+limit && n_russian >= n_afghan+limit)
		success = Russian;

	let final = is_final_dominance_check();
	if (final)
		log(`Final Dominance Check.`);

	let score = new Array(game.players.length).fill(0);
	if (success) {
		logbr();
		log(`.dc.${success} Dominant ${success} Coalition`);
		logbr();
		for (let p = 0; p < game.players.length; ++p) {
			if (game.players[p].loyalty === success) {
				score[p] = count_influence_points(p);
				log(`${player_names[p]} had ${score[p]} influence.`);
			}
		}
		if (final)
			assign_vp([10, 6, 2], score, score.filter(x=>x>0));
		else
			assign_vp([5, 3, 1], score, score.filter(x=>x>0));
	} else {
		logbr();
		log(`.dc.unsuccessful Unsuccessful Check`);
		logbr();
		for (let p = 0; p < game.players.length; ++p) {
			score[p] = count_cylinders_in_play(p);
			log(`${player_names[p]} had ${score[p]} cylinders.`);
		}
		if (final)
			assign_vp([6, 2], score, score.slice());
		else
			assign_vp([3, 1], score, score.slice());
	}

	// Clear the board.
	for (let i = 0; i < 36; ++i)
		game.pieces[i] = 0;

	// Prince Akbar Khan
	if (any_player_has_insurrection()) {
		log(`Insurrection placed two Afghan armies in Kabul.`);
		game.pieces[0] = Kabul;
		game.pieces[1] = Kabul;
	}

	// Check instant victory
	let vps = game.players.map((pp,i) => pp.vp).sort((a,b)=>b-a);
	if (vps[0] >= vps[1] + 4)
		goto_game_over();

	if (final)
		goto_game_over();

	game.events = {};
	for (let p = 0; p < game.players.length; ++p)
		game.players[p].events = {};
}

function vp_tie(pp) {
	let court = pp.court;
	let stars = 0;
	for (let i = 0; i < court.length; ++i) {
		let c = court[i];
		if (cards[c].suit === Military)
			stars += cards[c].rank;
	}
	return pp.vp * 10000 + stars * 100 + pp.coins;
}

function goto_game_over() {
	let vps = game.players.map((pp,i) => [vp_tie(pp),i]).sort((a,b)=>b[0]-a[0]);
	let result = [];
	for (let i = 0; i < vps.length; ++i)
		if (vps[i][0] === vps[0][0])
			result.push(player_names[vps[i][1]])
	game.result = result.join(", ");
	game.victory = result.join(" and ") + " won!";
	logbr();
	log(game.victory);
	game.state = 'game_over';
}

// SETUP

function prepare_deck() {
	let court_cards = [];
	for (let i = 1; i <= 100; ++i)
		court_cards.push(i);

	let event_cards = [];
	for (let i = 105; i <= 116; ++i)
		event_cards.push(i);

	let piles = [ [], [], [], [], [], [] ];

	shuffle(court_cards);

	for (let i = 0; i < 6; ++i)
		for (let k = 0; k < 5 + game.players.length; ++k)
			piles[i].push(court_cards.pop());

	// Leftmost pile is 5, rightmost pile is 0
	piles[3].push(101);
	piles[2].push(102);
	piles[1].push(103);
	piles[0].push(104);

	shuffle(event_cards);

	piles[4].push(event_cards.pop());
	piles[4].push(event_cards.pop());
	piles[3].push(event_cards.pop());
	piles[2].push(event_cards.pop());
	piles[1].push(event_cards.pop());
	piles[0].push(event_cards.pop());

	for (let i = 0; i < 6; ++i)
		shuffle(piles[i]);

	game.deck = piles.flat();
}

exports.setup = function (seed, scenario, options) {
	let player_count = scenario_player_count[scenario];

	game = {
		seed: seed,

		active: 0,
		state: "none",
		used_cards: [],
		used_pieces: [],
		count: 0,
		reserve: 0,
		selected: -1,
		region: 0,
		card: 0,
		where: 0,

		phasing: null,
		actions: 0,
		deck: [],
		favored: Political,
		events: {},
		pieces: new Array(36 + player_count * 10).fill(0),
		market_cards: [
			[0,0,0,0,0,0],
			[0,0,0,0,0,0],
		],
		market_coins: [
			[0,0,0,0,0,0],
			[0,0,0,0,0,0],
		],
		players: [],

		log: [],
		undo: [],
	};

	for (let i = 0; i < player_count; ++i) {
		game.players[i] = {
			vp: 0,
			loyalty: null,
			prizes: 0,
			coins: 4,
			hand: [],
			court: [],
			events: {},
		}
	}

	prepare_deck();

	for (let row = 0; row < 2; ++row)
		for (let col = 0; col < 6; ++col)
			game.market_cards[row][col] = game.deck.pop();

	// Starting loyalty, starting with a random player.
	game.state = 'loyalty';
	game.active = random(player_count);
	log(`Random start player is ${player_names[game.active]}.`);

	return save_game();
}

function load_game(state) {
	game = state;
	game.active = player_index[game.active];
	update_aliases();
}

function save_game() {
	game.active = player_names[game.active];
	return game;
}

exports.action = function (state, current, action, arg) {
	load_game(state);
	let S = states[game.state];
	if (action in S) {
		S[action](arg, current);
	} else {
		if (action === 'undo' && game.undo && game.undo.length > 0)
			pop_undo();
		else
			throw new Error("Invalid action: " + action);
	}
	return save_game();
}

exports.resign = function (state, current) {
	load_game(state);
	goto_game_over();
	return save_game();
}

exports.view = function(state, current) {
	current = player_index[current];
	load_game(state);

	view = {
		log: game.log,
		active: player_names[game.active],
		prompt: null,
		favored: game.favored,
		events: game.events,
		pieces: game.pieces,
		market_cards: game.market_cards,
		market_coins: game.market_coins,
		players: game.players,
		selected: game.selected,
	};

	if (game.state === 'game_over') {
		view.prompt = game.victory;
	} else if (current === 'Observer' || game.active !== current) {
		let inactive = states[game.state].inactive || game.state;
		view.prompt = `Waiting for ${player_names[game.active]} \u2014 ${inactive}...`;
	} else {
		view.actions = {}
		states[game.state].prompt();
		view.prompt = player_names[game.active] + ": " + view.prompt;
		if (game.undo && game.undo.length > 0)
			view.actions.undo = 1;
		else
			view.actions.undo = 0;
	}

	save_game();
	return view;
}
