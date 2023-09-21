insert or replace into titles ( title_id, title_name, bgg, is_symmetric ) values ( 'pax-pamir', 'Pax Pamir', 256960, 1 );
insert or ignore into setups ( title_id, player_count, scenario, options ) values
	( 'pax-pamir', 2, '2P', '{"open_hands":true}' ),
	( 'pax-pamir', 3, '3P', '{"open_hands":true}' ),
	( 'pax-pamir', 4, '4P', '{"open_hands":true}' ),
	( 'pax-pamir', 5, '5P', '{"open_hands":true}' )
;
