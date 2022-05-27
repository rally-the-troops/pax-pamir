"use strict";

// CHECK WEBP AVAILABILITY
(function () {
	let webp = new Image();
	webp.src = "data:image/webp;base64,UklGRjIAAABXRUJQVlA4ICYAAACyAgCdASoCAAEALmk0mk0iIiIiIgBoSygABc6zbAAA/v56QAAAAA==";
	webp.onerror = () => window.location = "/pax-pamir/webp.html";
})();

// CONSTANTS

const player_names = [ "Gray", "Blue", "Tan", "Red", "Black" ];
const player_index = Object.fromEntries(Object.entries(player_names).map(([k,v])=>[v,k|0]));

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

const Gift2 = 400;
const Gift4 = 401;
const Gift6 = 402;
const Safe_House = 500;

const region_index = {
	"Persia": Persia,
	"Transcaspia": Transcaspia,
	"Herat": Herat,
	"Kabul": Kabul,
	"Kandahar": Kandahar,
	"Punjab": Punjab,
};

const space_names = {
	[Persia]: "Persia",
	[Transcaspia]: "Transcaspia",
	[Herat]: "Herat",
	[Kabul]: "Kabul",
	[Kandahar]: "Kandahar",
	[Punjab]: "Punjab",
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

cards.forEach(card => {
	if (card) {
		card.region = region_index[card.region];
		if (card.name === 'EVENT')
			card.name = card.if_discarded + " / " + card.if_purchased;
	}
});

const event_cards = {
	new_tactics: 105,
	koh_i_noor: 106,
	courtly_manners: 107,
	rumor: 108,
	conflict_fatigue: 109,
	nationalism: 110,
	nation_building: 112,
	pashtunwali_values: 115,
	embarrassment_of_riches: 106,
	disregard_for_customs: 107,
};

const VP_OFFSET = [
	[-16, -16],
	[-32, 0],
	[0, 0],
	[-16, 16],
	[16, 16],
];

const VP_TRACK = [
	[ 91, 43 ],
	[ 183, 43 ],
	[ 273, 43 ],
	[ 363, 43 ],
	[ 454, 43 ],
	[ 545, 43 ],
	[ 635, 43 ],
	[ 726, 43 ],
	[ 816, 43 ],
	[ 906, 43 ],
	[ 996, 43 ],
	[ 1035, 78 ],
	[ 1035, 169 ],
	[ 1035, 259 ],
	[ 1035, 350 ],
	[ 1035, 441 ],
	[ 1035, 531 ],
	[ 996, 563 ],
	[ 906, 563 ],
	[ 816, 563 ],
	[ 726, 563 ],
	[ 635, 563 ],
	[ 545, 563 ],
	[ 454, 563 ],
];

// GAME STATE

function player_cylinders(p) {
	return 36 + p * 10;
}

function ruler_of_region(r) {
	let ruler = -1;

	let n_afghan = 0;
	let n_british = 0;
	let n_russian = 0;
	for (let i = 0; i < 12; ++i) {
		if (view.pieces[i] === r)
			n_afghan ++;
		if (view.pieces[i+12] === r)
			n_british ++;
		if (view.pieces[i+24] === r)
			n_russian ++;
	}

	let max_ruling = Math.max(n_afghan, n_british, n_russian);

	for (let p = 0; p < view.players.length; ++p) {
		let n_tribes = 0;
		let x = 36 + p * 10;
		for (let i = x; i < x + 10; ++i)
			if (view.pieces[i] === r)
				n_tribes++;

		let n_ruling = n_tribes;
		if (view.players[p].loyalty === 'Afghan')
			n_ruling += n_afghan;
		if (view.players[p].loyalty === 'British')
			n_ruling += n_british;
		if (view.players[p].loyalty === 'Russian')
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

function count_influence_points(p) {
	let n = 1 + view.players[p].prizes;
	let x = player_cylinders(p);

	if (!view.events.embarrassment_of_riches) {
		let gv = view.players[p].events.koh_i_noor ? 2 : 1;
		for (let i = x; i < x + 10; ++i) {
			let s = view.pieces[i];
			if (s === Gift2 || s === Gift4 || s === Gift6)
				n += gv;
		}
	}

	if (!view.players[p].events.rumor) {
		let court = view.players[p].court;
		for (let i = 0; i < court.length; ++i)
			if (cards[court[i]].patriot)
				++n;
	}

	return n;
}

function count_cylinders_in_play(p) {
	let n = 0;
	let x = player_cylinders(p);
	for (let i = x; i < x + 10; ++i)
		if (view.pieces[i] > 0)
			++n;
	return n;
}

function is_piece_army(i) {
	return (view.pieces[i] >= 201 && view.pieces[i] <= 206);
}

function is_piece_road(i) {
	return (view.pieces[i] >= 301 && view.pieces[i] <= 309);
}

function is_card_action(action, card) {
	if (view.actions && view.actions[action] && view.actions[action].includes(card))
		return true;
	return false;
}

function is_place_gift_action(i) {
	if (view.actions && view.actions.place_gift && view.actions.place_gift.includes(i))
		return true;
	return false;
}

function is_suit_action(suit) {
	if (view.actions && view.actions.suit && view.actions.suit.includes(suit))
		return true;
	return false;
}

function is_piece_action(i) {
	if (view.actions && view.actions.piece && view.actions.piece.includes(i))
		return true;
	return false;
}

function is_space_action(i) {
	if (view.actions && view.actions.space && view.actions.space.includes(i))
		return true;
	return false;
}

// UI ELEMENTS

let ui = {
	pieces: [],
	spaces: [],
	cards: [],
	spyrows: [],
	market_card: [[],[]],
	market_coin: [[],[]],
	card_action_index: { battle: [], betray: [], build: [], gift: [], move: [], tax: [] },
	card_action_element: { battle: [], betray: [], build: [], gift: [], move: [], tax: [] },
	player: [],
}

function scroll_to_map() {
	ui.board.scrollIntoView({behavior:'smooth'});
}

function scroll_to_market() {
	ui.market.scrollIntoView({behavior:'smooth'});
}

function scroll_to_player(p) {
	ui.player[p].area.scrollIntoView({behavior:'smooth'});
}

let open_toggle = true;
function toggle_open_hands() {
	open_toggle = !open_toggle;
	for (let p = 0; p < view.players.length; ++p)
		if (p !== player_index[player])
			ui.player[p].hand.classList.toggle("hide", open_toggle);
}

function on_blur() {
	ui.status.textContent = "";
	ui.tooltip.classList = "hide";
}

function on_focus_card_tip(c) {
	ui.tooltip.classList = "card card_" + c;
}

function on_click_card_tip(c) {
	ui.cards[c].scrollIntoView({behavior:'smooth'});
}

function on_focus_card(evt) {
	let c = evt.target.card;
	if (!evt.target.classList.contains("card_back")) {
		ui.status.textContent = `${evt.target.card} - ${cards[c].name}`;
		ui.tooltip.classList = "focus card card_" + c;
	}
}

function on_focus_space(evt) {
	ui.status.textContent = space_names[evt.target.space];
}

function on_click_space(evt) {
	send_action('space', evt.target.space);
	evt.stopPropagation();
}

function on_click_block(evt) {
	send_action('piece', evt.target.piece);
	evt.stopPropagation();
}

function on_click_cylinder(evt) {
	send_action('piece', evt.target.piece);
	evt.stopPropagation();
}

function toggle_hand(p) {
	ui.player[p].hand.classList.toggle("hide");
}

// CARD MENU

const card_action_menu = [
	'play_left',
	'play_right',
];

let current_popup_card = 0;

function show_popup_menu(evt, list) {
	document.querySelectorAll("#popup div").forEach(e => e.classList.remove('enabled'));
	for (let item of list) {
		let e = document.getElementById("menu_" + item);
		e.classList.add('enabled');
	}
	let popup = document.getElementById("popup");
	popup.style.display = 'block';
	popup.style.left = (evt.clientX-50) + "px";
	popup.style.top = (evt.clientY-12) + "px";
	ui.cards[current_popup_card].classList.add("selected");
	ui.popup_label.textContent = cards[current_popup_card].name;
}

function hide_popup_menu() {
	let popup = document.getElementById("popup");
	popup.style.display = 'none';
	if (current_popup_card) {
		ui.cards[current_popup_card].classList.remove("selected");
		current_popup_card = 0;
	}
}

function popup_action(action) {
	send_action(action, current_popup_card);
	hide_popup_menu();
}

function on_click_card(evt) {
	let c = evt.target.card;
	if (is_card_action('card', c)) {
		send_action('card', c);
	} else {
		let menu = card_action_menu.filter(a => is_card_action(a, c));
		if (menu.length > 0) {
			current_popup_card = c;
			show_popup_menu(evt, menu);
		}
	}
}

// LOG

function sub_card_name(match, p1) {
	let c = p1 | 0;
	let name = cards[c].name;
	return `<span class="tip" onmouseenter="on_focus_card_tip(${c})" onmouseleave="on_blur()" onclick="on_click_card_tip(${c})">${name}</span>`;
}

function on_log(text) {
	let p = document.createElement("div");
	if (text.match(/^>/)) {
		text = text.substring(1);
		p.className = 'i';
	}
	text = text.replace(/&/g, "&amp;");
	text = text.replace(/</g, "&lt;");
	text = text.replace(/>/g, "&gt;");
	text = text.replace(/#(\d+)/g, sub_card_name);
	if (text.match(/^.turn/)) {
		text = text.substring(6);
		p.className = 'turn ' + text;
	}
	let m;
	if ((m = text.match(/^.dc.(\w+) (.*)/))) {
		text = m[2];
		p.className = 'dc ' + m[1];
	}
	p.innerHTML = text;
	return p;
}

// LAYOUT

function layout_block_pool() {
	function place_block_pool(i, x, y) {
		ui.pieces[i].style = `top:${27+y*48}px;left:${1070+26+x*(26+35)}px`;
	}
	for (let k = 0, i = 0; i < 12; ++i) {
		if (view.pieces[i] === 0) {
			place_block_pool(i, 0, k);
			++k;
		}
	}
	for (let k = 0, i = 12; i < 24; ++i) {
		if (view.pieces[i] === 0) {
			place_block_pool(i, 1, k);
			++k;
		}
	}
	for (let k = 0, i = 24; i < 36; ++i) {
		if (view.pieces[i] === 0) {
			place_block_pool(i, 2, k);
			++k;
		}
	}
}

function layout_armies(list, xc, yc, maxcol) {
	function place_army(y, x, i) {
		ui.pieces[i].style = `top:${yc+y*16+x*1}px;left:${xc+x*26-y*16}px`;
	}
	let ncol = Math.min(maxcol, list.length);
	let nrow = Math.ceil(list.length / ncol);
	let i = 0;
	for (let row = 0; row < nrow; ++row)
		for (let col = 0; col < ncol && i < list.length; ++col)
			place_army(row, col - (ncol/2) - ((nrow-1)/4), list[i++]);
}

function layout_tribes_radial(list, xc, yc, maxcol) {
	function place_tribe(x, y, i) {
		ui.pieces[i].style = `top:${Math.round(y)}px;left:${Math.round(x)}px`;
	}
	let angle = 2 * Math.PI / Math.max(list.length, 7);
	let phase = (list.length <= 3) ? Math.PI * 2 / 7 : (list.length - 1) * angle / 2;
	for (let i = 0; i < list.length; ++i) {
		let x = xc + Math.sin(i * angle - phase) * 46 - 14;
		let y = yc - Math.cos(i * angle - phase) * 44 - 14;
		place_tribe(x, y, list[i]);
	}
}

function layout_region_armies(r, xc, yc, maxcol) {
	let list = [];
	for (let i = 0; i < 36; ++i)
		if (view.pieces[i] === r)
			list.push(i);
	layout_armies(list, xc - 4, yc, maxcol);
}

function layout_region_tribes(r, xc, yc, maxcol) {
	let list = [];
	for (let i = 36; i < view.pieces.length; ++i)
		if (view.pieces[i] === r)
			list.push(i);
	if (list.length > 0)
		layout_tribes_radial(list, xc, yc, maxcol);
}

function layout_border(r, xc, yc, line) {
	xc -= 24;
	yc -= 12;
	function place_piece_border(i, k) {
		let x, y;
		switch (line) {
		case 0: x = k * 18; y = k * 7; break;
		case 1: x = k * 4; y = k * 16; break;
		case 2: x = k * -4; y = k * 16; break;
		case 3: x = k * -12; y = k * 14; break;
		}
		ui.pieces[i].style = `top:${yc+y}px;left:${xc+x}px`;
	}
	let n = 0;
	for (let i = 0; i < view.pieces.length; ++i) {
		if (view.pieces[i] === r)
			++n;
	}
	for (let k = (-(n-1)/2), i = 0; i < view.pieces.length; ++i) {
		if (view.pieces[i] === r) {
			place_piece_border(i, k);
			++k;
		}
	}
}

// UPDATE UI

let once = true;

function on_update() {
	if (once) {
		build_ui();
		once = false;
	}

	function update_event_cards(node, events) {
		for (let evt in events)
			node.appendChild(ui.cards[event_cards[evt]]);
	}

	let ruler = [
		ruler_of_region(Persia),
		ruler_of_region(Transcaspia),
		ruler_of_region(Herat),
		ruler_of_region(Kabul),
		ruler_of_region(Kandahar),
		ruler_of_region(Punjab)
	];

	ui.prompt.innerHTML = view.prompt.replace(/#(\d+)/g, sub_card_name);

	ui.deck_info.textContent = `${view.cards[0]}x Draw Deck, ${view.cards[1]}x Dominance Check`;

	action_button("loyalty_afghan", "Afghan");
	action_button("loyalty_british", "British");
	action_button("loyalty_russian", "Russian");

	action_button("courtly_manners", "Courtly Manners");
	action_button("beg", "Beg");
	action_button("pay", "Pay");
	action_button("waive", "Waive");
	action_button("accept", "Accept");

	for (let i = 0; i < 10; ++i)
		action_button("offer_" + i, i);

	action_button("refuse", "Refuse");

	action_button("player_0", "Gray");
	action_button("player_1", "Blue");
	action_button("player_2", "Tan");
	action_button("player_3", "Red");
	action_button("player_4", "Black");

	action_button("pass", "Pass");
	action_button("next", "Next");
	action_button("end_game", "End game");
	confirm_action_button("end_turn_pass", "End turn",
		"Are you sure you want to END TURN while you still have actions?");
	action_button("end_turn", "End turn");
	action_button("undo", "Undo");

	ui.favored1.className = view.favored;
	ui.favored2.className = view.favored + " icon";

	for (let row = 0; row < 2; ++row) {
		for (let col = 0; col < 6; ++col) {
			let ce = ui.cards[view.market_cards[row][col]];
			if (ce)
				ce.classList.remove("card_back");
			let me = ui.market_card[row][col];
			if (me.firstChild !== ce) {
				if (me.firstChild)
					me.removeChild(me.firstChild);
				if (ce)
					me.appendChild(ce);
			}
			let coins = view.market_coins[row][col];
			if (coins > 0) {
				ui.market_coin[row][col].textContent = coins;
				ui.market_coin[row][col].className = "coin";
			} else {
				ui.market_coin[row][col].textContent = "";
				ui.market_coin[row][col].className = "coin hide";
			}
		}
	}

	for (let i = 1; i < cards.length; ++i) {
		ui.cards[i].classList.toggle('action', is_card_action('card', i));
	}

	for (let i = 201; i <= 206; ++i) {
		ui.spaces[i].classList.toggle('action', is_space_action(i));
		ui.spaces[i].classList.toggle('selected', view.where === i);
	}
	for (let i = 301; i <= 309; ++i)
		ui.spaces[i].classList.toggle('action', is_space_action(i));

	for (let i = 0; i < 36; ++i) {
		ui.pieces[i].classList.toggle('action', is_piece_action(i));
		ui.pieces[i].classList.toggle('selected', view.selected === i);
		ui.pieces[i].classList.toggle('road', is_piece_road(i));
		ui.pieces[i].classList.toggle('army', is_piece_army(i));
	}

	for (let p = 0; p < view.players.length; ++p) {
		let pp = view.players[p];
		let me = ui.player[p].court;
		while (me.firstChild)
			me.removeChild(me.firstChild);
		me.appendChild(ui.player[p].pool);
		update_event_cards(me, view.players[p].events);
		for (let i = 0; i < pp.court.length; ++i) {
			let ce = ui.cards[pp.court[i]];
			me.appendChild(ce);
			ce.classList.remove("card_back");
		}

		if (p === player_index[player]) {
			ui.player[p].gift_2.classList.toggle('action', is_place_gift_action(2));
			ui.player[p].gift_4.classList.toggle('action', is_place_gift_action(4));
			ui.player[p].gift_6.classList.toggle('action', is_place_gift_action(6));
		}

		me = ui.global_events;
		while (me.firstChild)
			me.removeChild(me.firstChild);
		update_event_cards(me, view.events);

		me = ui.player[p].hand;
		while (me.firstChild)
			me.removeChild(me.firstChild);
		if (p === player_index[player])
			me.classList.remove("hide");
		for (let i = 0; i < pp.hand.length; ++i) {
			let ce = ui.cards[pp.hand[i]];
			if (p !== player_index[player] && !view.open)
				ce.classList.add("card_back");
			else
				ce.classList.remove("card_back");
			me.appendChild(ce);
		}

		if (view.players[p].coins === 0) {
			ui.player[p].coin.classList.add("hide");
		} else {
			ui.player[p].coin.classList.remove("hide");
			ui.player[p].coin.textContent = view.players[p].coins;
		}

		if (view.players[p].prizes === 0) {
			ui.player[p].prize.classList.add("hide");
		} else {
			ui.player[p].prize.classList.remove("hide");
			if (view.players[p].prizes === 1)
				ui.player[p].prize.textContent = view.players[p].prizes + " prize";
			else
				ui.player[p].prize.textContent = view.players[p].prizes + " prizes";
		}

		ui.player[p].role.classList.toggle("active", p === player_index[view.active])

		ui.player[p].dial.className = "player_dial " + view.players[p].loyalty + " p" + p;

		ui.player[p].role_loy_icon.className = "role_loyalty_icon " + view.players[p].loyalty;
		ui.player[p].role_loy_text.textContent = count_influence_points(p);
		ui.player[p].role_cyl_text.textContent = count_cylinders_in_play(p);
		ui.player[p].role_rup_text.textContent = view.players[p].coins;

		ui.player[p].hand_size.textContent = view.players[p].hand.length;

		ui.player[p].score.style.left = (VP_OFFSET[p][0] + VP_TRACK[view.players[p].vp][0]) + "px";
		ui.player[p].score.style.top = (VP_OFFSET[p][1] + VP_TRACK[view.players[p].vp][1]) + "px";

		for (let i = 0; i < 10; ++i) {
			let x = 36 + p * 10 + i;
			let s = view.pieces[x];
			if (s === 0 || s === Safe_House)
				ui.player[p].pool.appendChild(ui.pieces[x]);
			else if (s === Gift2)
				ui.player[p].gift_2.appendChild(ui.pieces[x]);
			else if (s === Gift4)
				ui.player[p].gift_4.appendChild(ui.pieces[x]);
			else if (s === Gift6)
				ui.player[p].gift_6.appendChild(ui.pieces[x]);
			else if (s <= 100)
				ui.spyrows[s].appendChild(ui.pieces[x]);
			else
			{
				if (ui.pieces[x].parentElement !== ui.board)
					ui.board.appendChild(ui.pieces[x]);
			}
			ui.pieces[x].classList.toggle('action', is_piece_action(x));
			ui.pieces[x].classList.toggle('selected', view.selected === x);
			ui.pieces[x].style = "";
		}
	}

	for (let i = 0; i < 6; ++i)
		if (ruler[i] === -1)
			ui.rule[i].classList = `rule ${space_names[i+Persia]} hide`;
		else
			ui.rule[i].classList = `rule ${space_names[i+Persia]} ${player_names[ruler[i]]}`;

	ui.suit_political.classList.toggle('action', is_suit_action('Political'));
	ui.suit_intelligence.classList.toggle('action', is_suit_action('Intelligence'));
	ui.suit_economic.classList.toggle('action', is_suit_action('Economic'));
	ui.suit_military.classList.toggle('action', is_suit_action('Military'));

	layout_block_pool();

	layout_region_armies(Persia, 204, 466, 5);
	layout_region_armies(Transcaspia, 252, 227, 6);
	layout_region_armies(Herat, 454, 458, 6);
	layout_region_armies(Kabul, 671, 238, 8);
	layout_region_armies(Kandahar, 730, 477, 5);
	layout_region_armies(Punjab, 928+10, 381, 4);

	layout_region_tribes(Persia, 204, 426, 5);
	layout_region_tribes(Transcaspia, 252, 152+5, 10);
	layout_region_tribes(Herat, 454, 383, 6);
	layout_region_tribes(Kabul, 671, 163, 12);
	layout_region_tribes(Kandahar, 730, 437, 6);
	layout_region_tribes(Punjab, 928, 306, 3);

	layout_border(Persia_Transcaspia, 188, 320, 0);
	layout_border(Persia_Herat, 313, 441, 1);
	layout_border(Transcaspia_Herat, 371, 297, 3);
	layout_border(Transcaspia_Kabul, 477, 164, 1);
	layout_border(Herat_Kabul, 527, 297, 0);
	layout_border(Herat_Kandahar, 598, 441, 2);
	layout_border(Kabul_Kandahar, 699, 338, 0);
	layout_border(Kabul_Punjab, 859, 211, 2);
	layout_border(Kandahar_Punjab, 836, 438, 1);

	for (let action in ui.card_action_index) {
		for (let i = 0; i < ui.card_action_index[action].length; ++i) {
			let c = ui.card_action_index[action][i];
			let e = ui.card_action_element[action][i];
			e.classList.toggle("action", is_card_action(action, c));
		}
	}
}

// BUILD UI

function build_ui() {
	let passive_cards = [1,3,5,15,17,21,24,41,42,43,51,54,56,66,68,70,72,78,83,91,97,99];

	function build_player_ui(p) {
		return {
			role: document.getElementById("role_" + player_names[p]),
			role_rup_text: document.getElementById("rupees_" + p + "_text"),
			role_cyl_text: document.getElementById("cylinders_" + p + "_text"),
			role_loy_text: document.getElementById("loyalty_" + p + "_text"),
			role_loy_icon: document.getElementById("loyalty_" + p + "_icon"),
			score: document.getElementById("player_score_" + p),
			area: document.getElementById("player_area_" + p),
			hand_size: document.getElementById("player_hand_size_" + p),
			hand: document.getElementById("player_hand_" + p),
			court: document.getElementById("player_court_" + p),
			pool: document.getElementById("player_pool_" + p),
			dial: document.getElementById("player_dial_" + p),
			coin: document.getElementById("player_coin_" + p),
			prize: document.getElementById("player_prize_" + p),
			gift_2: document.getElementById("player_gift_" + p + "_2"),
			gift_4: document.getElementById("player_gift_" + p + "_4"),
			gift_6: document.getElementById("player_gift_" + p + "_6"),
		}
	}

	function build_card_action(card, action, i, x) {
		let e = document.createElement("div");
		e.className = `card_action ${action} n${x}`;
		e.addEventListener("click", () => send_action(action, i));
		ui.card_action_index[action].push(i);
		ui.card_action_element[action].push(e);
		card.appendChild(e);
	}

	function build_space(i, n) {
		ui.spaces[i] = document.getElementById("svgmap").getElementById(n);
		ui.spaces[i].space = i;
		ui.spaces[i].addEventListener("click", on_click_space);
		ui.spaces[i].addEventListener("mouseenter", on_focus_space);
		ui.spaces[i].addEventListener("mouseleave", on_blur);
	}

	for (let c = 1; c < cards.length; ++c) {
		let e = document.createElement("div");
		e.card = c;
		if (c <= 100) {
			let info = cards[c];
			e.className = "card card_" + c + " " + info.suit;
			let n = 0;
			if (info.gift) ++n, build_card_action(e, 'gift', c, info.gift);
			if (info.move) ++n, build_card_action(e, 'move', c, info.move);
			if (info.betray) ++n, build_card_action(e, 'betray', c, info.betray);
			if (info.battle) ++n, build_card_action(e, 'battle', c, info.battle);
			if (info.build) ++n, build_card_action(e, 'build', c, info.build);
			if (info.tax) ++n, build_card_action(e, 'tax', c, info.tax);
			if (passive_cards.includes(c))
				e.classList.add("passive");
			if (n === 3)
				e.classList.add("three");
		} else {
			e.className = "event card card_" + c;
		}
		e.addEventListener("click", on_click_card);
		e.addEventListener("mouseenter", on_focus_card);
		e.addEventListener("mouseleave", on_blur);
		ui.cards[c] = e;
		let ee = document.createElement("div");
		ee.className = "spyrow";
		e.appendChild(ee);
		ui.spyrows[c] = ee;
	}

	for (let row = 0; row < 2; ++row) {
		for (let col = 0; col < 6; ++col) {
			ui.market_card[row][col] = document.getElementById("market_card_" + row + "_" + col);
			ui.market_coin[row][col] = document.getElementById("market_coin_" + row + "_" + col);
		}
	}

	for (let p = 0; p < 5; ++p) {
		ui.player[p] = build_player_ui(p);

		ui.player[p].hand_size.addEventListener("click",
			() => toggle_hand(p));

		for (let i = 0; i < 10; ++i) {
			let x = 36 + p * 10 + i;
			ui.pieces[x] = document.createElement("div");
			ui.pieces[x].piece = x;
			ui.pieces[x].className = "cylinder p" + p;
			ui.pieces[x].addEventListener("click", on_click_cylinder);
			ui.player[p].pool.appendChild(ui.pieces[x]);
		}

		ui.player[p].gift_2.addEventListener("click", () => send_action('place_gift', 2));
		ui.player[p].gift_4.addEventListener("click", () => send_action('place_gift', 4));
		ui.player[p].gift_6.addEventListener("click", () => send_action('place_gift', 6));
	}

	ui.rule = [
		document.querySelector(`#board .rule.Persia`),
		document.querySelector(`#board .rule.Transcaspia`),
		document.querySelector(`#board .rule.Herat`),
		document.querySelector(`#board .rule.Kabul`),
		document.querySelector(`#board .rule.Kandahar`),
		document.querySelector(`#board .rule.Punjab`),
	];

	ui.prompt = document.getElementById("prompt");
	ui.deck_info = document.getElementById("deck_info");
	ui.board = document.getElementById("board");
	ui.market = document.getElementById("market");
	ui.status = document.getElementById("status");
	ui.tooltip = document.getElementById("tooltip");
	ui.favored1 = document.getElementById("favored_suit_marker");
	ui.favored2 = document.getElementById("favored_suit_banner");
	ui.popup_label = document.getElementById("popup_label");
	ui.global_events = document.getElementById("global_events");

	ui.suit_political = document.getElementById("suit_political");
	ui.suit_intelligence = document.getElementById("suit_intelligence");
	ui.suit_economic = document.getElementById("suit_economic");
	ui.suit_military = document.getElementById("suit_military");

	ui.suit_political.addEventListener("click", () => send_action('suit', 'Political'));
	ui.suit_intelligence.addEventListener("click", () => send_action('suit', 'Intelligence'));
	ui.suit_economic.addEventListener("click", () => send_action('suit', 'Economic'));
	ui.suit_military.addEventListener("click", () => send_action('suit', 'Military'));

	build_space(Transcaspia, "Transcaspia");
	build_space(Kabul, "Kabul");
	build_space(Punjab, "Punjab");
	build_space(Persia, "Persia");
	build_space(Herat, "Herat");
	build_space(Kandahar, "Kandahar");
	build_space(Persia_Transcaspia, "Persia/Transcaspia");
	build_space(Persia_Herat, "Persia/Herat");
	build_space(Transcaspia_Herat, "Transcaspia/Herat");
	build_space(Transcaspia_Kabul, "Transcaspia/Kabul");
	build_space(Herat_Kabul, "Herat/Kabul");
	build_space(Herat_Kandahar, "Herat/Kandahar");
	build_space(Kabul_Kandahar, "Kabul/Kandahar");
	build_space(Kabul_Punjab, "Kabul/Punjab");
	build_space(Kandahar_Punjab, "Kandahar/Punjab");

	function make_block(p, faction) {
		let div = document.createElement("div");
		div.className = faction + " block";
		div.piece = p;
		div.addEventListener("click", on_click_block);
		ui.board.appendChild(div);
		return div;
	}

	for (let i = 0; i < 12; ++i) ui.pieces[i] = make_block(i, "Afghan");
	for (let i = 12; i < 24; ++i) ui.pieces[i] = make_block(i, "British");
	for (let i = 24; i < 36; ++i) ui.pieces[i] = make_block(i, "Russian");

	// Sort player roles so active player is on top!
	let top = player === 'Observer' ? 0 : player_index[player];
	let alist = document.getElementById("player_area_list");
	let rlist = document.getElementById("roles");
	for (let p = top; p < view.players.length; ++p) {
		alist.appendChild(ui.player[p].area);
		rlist.appendChild(ui.player[p].role);
		ui.player[p].area.classList.remove("hide");
		ui.player[p].role.classList.remove("hide");
		ui.player[p].score.classList.remove("hide");
	}
	for (let p = 0; p < top; ++p) {
		alist.appendChild(ui.player[p].area);
		rlist.appendChild(ui.player[p].role);
		ui.player[p].area.classList.remove("hide");
		ui.player[p].role.classList.remove("hide");
		ui.player[p].score.classList.remove("hide");
	}

	if (player !== 'Observer')
		ui.player[top].hand_size.classList.add("hide");
}

function debug() {
	function rr(k,v) { return k === 'log' || k === 'players' || k === 'actions' ? undefined: v; }
	console.log("VIEW", JSON.stringify(view, rr, 0));
	console.log("ACTIONS", JSON.stringify(view.actions, rr, 0));
	for (let i = 0; i < view.players.length; ++i)
		console.log("PLAYER", i, JSON.stringify(view.players[i], rr, 0));
}
