const Lang = imports.lang;
const Soup = imports.gi.Soup;
const Main = imports.ui.main;
const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();
const Convenience = Me.imports.convenience;
const Settings = Convenience.getSettings();
const TimeZone = imports.gi.GLib.TimeZone;
const DateTime = imports.gi.GLib.DateTime;
const Mainloop = imports.mainloop;

const Constants = Me.imports.constants;

const TIME_OUT_ATTEMPTS = 3;
const TIME_OUT_DURATION = 3500;

const Gettext = imports.gettext;
const _ = Gettext.gettext;

const Duolingo = new Lang.Class({
	Name: 'Duolingo',

	_init: function(login) {
		this.login = login;
		this.raw_data = null;
		this.timeouts = TIME_OUT_ATTEMPTS;
		// this.session = new Soup.Session();
		// this.session.user_agent = Me.metadata.uuid;
		// this.session.connect('authenticate', Lang.bind(this, function() {
		// 	global.log('authentication...');
		// }));
		// this.auth = null;
		// this.authenticate(login, 'Obama32');
	},

	/* Calls the server and saves the answer in the property raw_data.
	If the user is not found, displays a notification, and the menu is not built.
	If an error different than 200 is returned, displays a notification, and the menu is not built. */
	get_raw_data: function(callback) {
		if (!this.login) {
			callback(_("Please enter a username in the settings."));
			return null;
		}

		if (this.raw_data != null) {
			return this.raw_data;
		}

		let url = 'https://duolingo.com/users/' + this.login;
		if (Settings.get_boolean(Constants.SETTING_SHOW_ICON_IN_NOTIFICATION_TRAY)) {
			url = url.replace(Constants.LABEL_DUOLINGO, Constants.LABEL_DUOLINGO_WITH_WWW_PREFIX);
		}
		let request = Soup.Message.new('GET', url);
		let session = new Soup.SessionSync();
		session.queue_message(request, Lang.bind(this, function(session, response) {
			if (response.status_code == 200) {
				try {
					this.raw_data = JSON.parse(response.response_body.data);
					callback();
				} catch (err) {
					global.log(err);
					callback(_("The user couldn't be found."));
				}
			} else {
				this.timeouts--;
				if (this.timeouts == 0) {
					callback(_("The server couldn't be reached."));
				} else {
					Mainloop.timeout_add(TIME_OUT_DURATION, Lang.bind(this, function() {
						this.get_raw_data(callback);
					}));
				}
			}
		}));
		return this.raw_data;
	},

	/* Returns today's timestamp at midnight, relative to your time zone. */
	get_duolingos_daystart : function() {
		let tz = TimeZone.new_local();
		let now = DateTime.new_now(tz);
		let year = now.get_year();
		let month = now.get_month();
		let day = now.get_day_of_month();
		let day_start = DateTime.new(tz,year, month, day, 0, 0, 0.0);
		return day_start.to_utc().to_unix() * 1000;
	},

	/** Returns the sum of improvements for the given date */
	get_improvement: function() {
		let take_after = this.get_duolingos_daystart();
		let improvements = this.get_raw_data().calendar;
		let sum = 0;
		for (let i in improvements) {
			let date = improvements[i].datetime;
			if (take_after < date) {
				sum += parseInt(improvements[i].improvement);
			}
		}
		return sum;
	},

	get_daily_goal: function() {
		return this.get_raw_data().daily_goal;
	},

	/** Returns an Array of the learnt languages by the given profile. The current language is in first position.
	Each element of the returned array contains the followinf keys: 'label', 'level', 'points', 'to_next_level'. */
	get_languages: function(callback) {
		let languages = this.get_raw_data().languages;
		let current_language;
		let learnt_languages = new Array();
		for (let l in languages) {
			if (Boolean(languages[l].learning)) {
				/* save the language and the related information in a cell */
				let language = new Array();
				language[Constants.LANGUAGE_LABEL] = languages[l].language_string;
				language[Constants.LANGUAGE_CODE] = languages[l].language;
				language[Constants.LANGUAGE_LEVEL] = languages[l].level;
				language[Constants.LANGUAGE_POINTS] = languages[l].points;
				language[Constants.LANGUAGE_TO_NEXT_LEVEL] = languages[l].to_next_level;
				language[Constants.LANGUAGE_CURRENT_LANGUAGE] = languages[l].current_learning;

				/* add the current language in the final list */
				if (Boolean(languages[l].current_learning)) {
					let tmp = [language];
					learnt_languages = tmp.concat(learnt_languages);
				} else {
					learnt_languages.push(language);
				}
			}
		}
		return learnt_languages;
	},

	get_current_learning_language: function() {
		let languages = this.get_languages();
		for (let l in languages) {
			if(languages[l][Constants.LANGUAGE_CURRENT_LANGUAGE]) {
				return languages[l];
			}
		}
		return null;
	},

	get_lingots: function() {
		return this.get_raw_data().rupees;
	},

	get_streak: function() {
		return this.get_raw_data().site_streak;
	},

	is_daily_goal_reached: function() {
		return this.get_improvement() >= this.get_daily_goal();
	},

	is_frozen: function() {
		return this.get_raw_data().inventory != null && this.get_raw_data().inventory.streak_freeze != null;
	},

	get_double_or_nothing_status: function() {
		if (this.get_raw_data().inventory != null)
			return this.get_raw_data().inventory.rupee_wager;
		return null;
	},

	get_learned_chapters: function() {
		let results = new Array();
		let current_language =  this.get_current_learning_language()[Constants.LANGUAGE_CODE];
		let skills = this.get_raw_data().language_data[current_language].skills;
		for (let s in skills) {
			if (skills[s].learned) {
				results.push(skills[s]);
			}
		}
		return results;
	},

	get_count_learned_chapters: function() {
		return this.get_learned_chapters().length;
	},

	get_count_available_chapters: function() {
		let current_language =  this.get_current_learning_language()[Constants.LANGUAGE_CODE];
		return this.get_raw_data().language_data[current_language].skills.length;
	},

	post_switch_language: function(new_language_code) {
		global.log('learning_language=' + new_language_code);




		let session = new Soup.SessionSync();
		session.user_agent = Me.metadata.uuid;
		session.prefetch_dns('https://www.duolingo.com/', null, function() {global.log('done');});

		let authURL = 'https://www.duolingo.com/login';
		let authParams = {'login': 'newbie32', 'password': 'Obama32'};
		let message = Soup.form_request_new_from_hash('POST', authURL, authParams);
		message.request_headers.append('Connection', 'keep-alive');
		session.use_ntlm = false;
		let auth = new Soup.AuthBasic();
		auth.authenticate('newbie32', 'Obama32');
		message.request_headers.append('Authorization', auth.get_authorization(message));
		session.queue_message(message, Lang.bind(this, function(session, response) {
			global.log('AUTHENTICATE: ' + response.status_code + ' - ' + response.reason_phrase);
			global.log('AUTHENTICATE: ' + response.response_body.data);

			let url = 'https://www.duolingo.com/switch_language';
			let params = {'learning_language': new_language_code};
			let msg = Soup.form_request_new_from_hash('POST', url, params);
			// msg.request_headers.append('Authorization', '534bff4cc1a4757cd9dca2bfbadb844e57c87594113295907');
			msg.request_headers.append('Connection', 'keep-alive');
			global.log('is authenticated: ' + auth.is_authenticated);
			// auth_tkt="534bff4cc1a4757cd9dca2bfbadb844e57c87594113295907!userid_type:int"
			msg.request_headers.append('Authorization', auth.get_authorization(msg));

			session.queue_message(msg, Lang.bind(this, function(session, response) {
				global.log(response.status_code + ' - ' + response.reason_phrase);
				global.log(response.response_headers.get_one('content-type'));
			}));
		}));




		// session.connect('authenticate', Lang.bind(this, function() {
		// 	global.log('authentication...');
		// }));
		// this.authenticate('newbie32', 'Obama32');

		// this.authenticate(session, 'newbie32', 'Obama32', new_language_code);
		//
		// let url = 'https://www.duolingo.com/switch_language';
		// // let request = Soup.Message.new('POST', url);
		// let params = {'learning_language': new_language_code};
		// let message = Soup.form_request_new_from_hash('POST', url, params);
		//user id: 113295907
		// message.request_headers.append("X-Authorization-key", '2b1e8b43e58b3687a6c507cf2bdd52dc57c2f539113295907');
		// let auth = new Soup.AuthBasic();
		// auth.authenticate('newbie32', 'Obama32');
		// let authorization = auth.get_authorization(message);
		// global.log('Authorization: ' + authorization);
		// message.request_headers.append('Authorization', authorization);
		// request.set_request('application/x-www-form-urlencoded', 2, params, params.length);

		// let auth = new Soup.AuthBasic()
		// auth.authenticate('newbie32', 'Obama32');
		// request.request_headers.append('Authorization', auth.get_authorization(request));

		// session.queue_message(message, Lang.bind(this, function(session, response) {
		// 	global.log('SWITCH: ' + response.status_code + ' - ' + response.reason_phrase);
		// 	// if (response.status_code == 200) {
		// 	global.log('SWITCH: ' + response.response_headers.get_one('content-type'));
		// 	// global.log(response.response_body.data);
		// 	// 	// global.log(response.request_headers.get_content_type());
		// 	// 	// global.log(response.response_headers.get_content_type()); //
		// 	// }
		// }));
	},

	authenticate: function(session, username, password, new_language_code) {
		let url = 'https://www.duolingo.com/login';
		let request = Soup.Message.new('POST', url);
		let params = 'login=' + username + '&password=' + password;
		request.set_request('application/x-www-form-urlencoded', 2, params, params.length);
		let cookieJar = new Soup.CookieJar();
		global.log(cookieJar);
		session.addfeature(cookieJar);
		global.log('session: ' + session);
		session.queue_message(request, Lang.bind(this, function(session, response) {
			global.log('AUTHENTICATE: ' + response.status_code + ' - ' + response.reason_phrase);
			global.log('AUTHENTICATE: ' + response.response_body.data);

			let url = 'https://www.duolingo.com/switch_language';
			// let request = Soup.Message.new('POST', url);
			let params = {'learning_language': new_language_code};
			let message = Soup.form_request_new_from_hash('POST', url, params);
			global.log('session: ' + session);
			session.queue_message(message, Lang.bind(this, function(session, response) {
				global.log('SWITCH: ' + response.status_code + ' - ' + response.reason_phrase);
				// if (response.status_code == 200) {
				global.log('SWITCH: ' + response.response_headers.get_one('content-type'));
				// global.log(response.response_body.data);
				// 	// global.log(response.request_headers.get_content_type());
				// 	// global.log(response.response_headers.get_content_type()); //
				// }
			}));
		}));
	}
});
