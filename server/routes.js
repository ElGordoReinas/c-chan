const dbManager = require('./db/dbmanager.js');
const models = require('./db/models/dbmodels.js');
const api = require('./api.js');
const adm = require('./adm.js');
const utils = require('./utils.js');
const renderConfig = require('./config/renderconfig.js');
const sConfig = require('./config/serverconfig.js');
const mdbScheme = require('./db/models/mdbscheme.js');
const compat = require('./db/compat.js');
const cfilter = require('./sesion/contentfilter.js');
const sesion = require('./sesion/sesionmanager.js');
const pass = require('./api/passport.js');
const access = require('./api/access.js');

const rate = require('./sesion/limiter.js');
const sesionManager = require('./sesion/sesionmanager.js');


module.exports = function(app){
	
	/* RUTA DE LOGEO */
	app.get('/login', function(req, res) {
		var uid = req.session.uid;
		dbManager.mQuery(req.app.locals.db, models.HOME_QUERY(uid), function(result){
			res.render("login", {
				it : {
					kind: req.originalUrl,
					host: req.get('host'),
					utils: utils,
					renderConfig: renderConfig,
					sesion: req.session,
					data: result
				}
			});
		});
	});
	
	//API: login de usuario.
	//TODO: comprobacion de credenciales, sanitizado
	app.post('/api/login', rate.loginLimit, access.login, async function(req, res) {
		let userid = (req.fields.userid.trim() === "") ? req.session.uid : req.fields.userid.trim();
		let password = req.fields.password.trim();
		
		dbManager.queryDB(req.app.locals.db, mdbScheme.C_ADM, {$or: [{uid: userid}, {nick: new RegExp(userid, "i")}]}, "", async function(user){
			if (user[0]){
				//existe el usuario, comparar contraseña.
				//TODO: esto tendría que recibir la contraseña encriptada y bla bla bla..
				if (password !== user[0].pass){
					res.json({success: false, data: "Contraseña incorrecta."});
				} else {
					//aplicar usuario a la sesion actual.
					//TODO: añadir soporte de multiples sesiones del mismo usuario.
					await dbManager.pushDB(req.app.locals.db, mdbScheme.C_ADM, {uid: user[0].uid}, {$set: {sid: req.session.id}});
					req.session.uid = user[0].uid;
					req.session.config = user[0].extra.config;
					sesionManager.disposeUserCache(req.session.id);
					console.log("[Sesion] Usuario logeado.");
					res.json({success: true, data: "logueado."});
				}
			} else {
				//crear usuario
				//primero, comprobar que el userid sea un id valido de 32 caracteres.
				if (userid.trim().length !== 32){
					res.json({success: false, data: "ID invalido, tiene que tener 32 caracteres."});
				} else {
					let json = sesionManager.genUser(userid, password, req.session.id);
					dbManager.insertDB(req.app.locals.db, mdbScheme.C_ADM, json, function(response){
						req.session.uid = json.uid;
						req.session.config = json.extra.config;
						sesionManager.disposeUserCache(req.session.id);
					});
					console.log("[Sesion] Usuario creado.");
					res.json({success: true, data: json});
				}
			}
		});
	});
	
	/* WhiteWall */
	app.use(access.whitewall);
	
	/* RUTA PRINCIPAL */
	app.get('/', function(req, res) {
		var uid = req.session.uid;
		dbManager.mQuery(req.app.locals.db, models.HOME_QUERY(uid), function(result){
			//filtro de cosas ocultas
			result[mdbScheme.C_BOXS] = cfilter.filterBoxHides(result[mdbScheme.C_BOXS], req.session.config);			
			//limite despues del filtro
			result[mdbScheme.C_BOXS] = result[mdbScheme.C_BOXS].slice(0, sConfig.HOME_BOX_LIMIT);
			
			res.render("main", {
				it : {
					kind: req.originalUrl,
					host: req.get('host'),
					utils: utils,
					renderConfig: renderConfig,
					sesion: req.session,
					data: result
				}
			});
		});
	});
	
	/* RUTA DE COMUNIDADES */
	app.get('/comunidades', function(req, res) {
		var uid = req.session.uid;
		dbManager.mQuery(req.app.locals.db, models.HOME_QUERY(uid), function(result){
			res.render("./v1/index", {
				it : {
					kind: req.originalUrl,
					host: req.get('host'),
					utils: utils,
					renderConfig: renderConfig,
					sesion: req.session,
					data: result
				}
			});
		});
	});
	
	/* RUTA DEL PANEL DE ADMINISTRACION */
	app.get('/adm', pass.onlyADM, function(req, res) {
		let uid = req.session.uid;
		let sid = req.session.id;
		let userData = sesion.getUserData(sid)[0].data;
		
		dbManager.mQuery(req.app.locals.db, models.HOME_QUERY(uid), function(result){
			res.render("adm", {
				it : {
					kind: req.originalUrl,
					host: req.get('host'),
					utils: utils,
					renderConfig: renderConfig,
					sesion: req.session,
					data: result,
					userdata: userData
				}
			});
		});
	});
	
	//RUTA: lista de publicaciones propias.
	app.get('/propios', function(req, res) {
		
		let filter = {"user.uid": req.session.uid};
		dbManager.queryDB(req.app.locals.db, mdbScheme.C_BOXS, filter, {"date.created": -1, "date.bump": -1}, function(rboxs){
			dbManager.mQuery(req.app.locals.db, models.HOME_QUERY(req.session.uid), function(result){
				result[mdbScheme.C_BOXS] = rboxs;
				res.render("index", {
					it : {
						kind: req.originalUrl,
						host: req.get('host'),
						utils: utils,
						renderConfig: renderConfig,
						sesion: req.session,
						data: result
					}
				});
			});
		});
	});
	
	//RUTA: lista de favoritos.
	//llamada para añadir elemento: applyConfig("favs_add:bid"), donde bid es el id del box a añadir a favoritos.
	app.get('/favoritos', function(req, res) {
		//leer favoritos del usuario
		let favoritos = req.session.config.favs;
		
		//preparar filtro para mongodb
		//TODO: filtrar elementos para evitar ataques a la base de datos.
		let filterArrayElements = [];
		favoritos.forEach(function(fav){
			filterArrayElements.push({bid: fav});
		});
		let filter = {$or: filterArrayElements};
		
		dbManager.queryDB(req.app.locals.db, mdbScheme.C_BOXS, filter, {"date.created": -1, "date.bump": -1}, function(rboxs){
			dbManager.mQuery(req.app.locals.db, models.HOME_QUERY(req.session.uid), function(result){
				result[mdbScheme.C_BOXS] = rboxs;
				res.render("index", {
					it : {
						kind: req.originalUrl,
						host: req.get('host'),
						utils: utils,
						renderConfig: renderConfig,
						sesion: req.session,
						data: result
					}
				});
			});
		});
	});
	
	//RUTA: lista de temas ocultos.
	//llamada para añadir elemento: applyConfig("boxhides_add:bid"), donde bid es el id del box a ocultar.
	//TODO: hacer generico el codigo repetido.
	app.get('/ocultos', function(req, res) {
		let ocultos = req.session.config.boxhides;
		
		let filterArrayElements = [];
		ocultos.forEach(function(oculto){
			filterArrayElements.push({bid: oculto});
		});
		let filter = {$or: filterArrayElements};
		
		dbManager.queryDB(req.app.locals.db, mdbScheme.C_BOXS, filter, {"date.created": -1, "date.bump": -1}, function(rboxs){
			dbManager.mQuery(req.app.locals.db, models.HOME_QUERY(req.session.uid), function(result){
				result[mdbScheme.C_BOXS] = rboxs;
				res.render("index", {
					it : {
						kind: req.originalUrl,
						host: req.get('host'),
						utils: utils,
						renderConfig: renderConfig,
						sesion: req.session,
						data: result
					}
				});
			});
		});
	});
	
	//RUTA: buscar palabras clave en temas y devolver resultado
	app.get('/search/:query', function(req, res) {
		let query = req.params.query;
		
		let regexQuery = {$regex: '.*' + query + '.*', $options: 'i'};
		let search = {$or: [
				{"content.title": regexQuery},
				{"content.body": regexQuery},
				{"content.extra.title2": regexQuery}
		]};
		
		dbManager.queryDB(req.app.locals.db, mdbScheme.C_BOXS, search, {"date.created": -1, "date.bump": -1}, function(rboxs){
			dbManager.mQuery(req.app.locals.db, models.HOME_QUERY(req.session.uid), function(result){
				result[mdbScheme.C_BOXS] = rboxs;
				res.render("index", {
					it : {
						kind: req.originalUrl,
						host: req.get('host'),
						utils: utils,
						renderConfig: renderConfig,
						sesion: req.session,
						data: result
					}
				});
			});
		});
	});
	
	/* RUTAS DEL API */
	api(app);
	
	/* RUTAS DE ADMINISTRACION */
	adm(app);
	
	//RUTA: pagina de info, bienvenida, faqs, reglas, etc.
	app.get('/info', function(req, res) {
		var id = req.params.id;
		res.render("info", {
			it : {
					kind: req.originalUrl,
					host: req.get('host'),
					utils: utils,
					renderConfig: renderConfig,
					sesion: req.session
				}
		});
	});
	
	/* CATEGORIAS */
	app.get('/:cat', function(req, res) {
		var cat = req.params.cat;
		var uid = req.session.uid;
		//el server hace un pequeño request de la lista de categorias, si existe accede a ella.
		dbManager.queryDB(req.app.locals.db, mdbScheme.C_CATS, {"catid": cat}, "", function(result){
			if (!result[0]){
				res.redirect("/error/2");
			} else {
				//si existe la categoria, cargar los boxs que pertenezcan a ella.
				//TODO
				dbManager.mQuery(req.app.locals.db, models.CAT_QUERY(uid, cat), function(result){
					result[mdbScheme.C_BOXS] = cfilter.filterOnlyHides(result[mdbScheme.C_BOXS], req.session.config);
					res.render("main", {
						it : {
							kind: req.originalUrl,
							host: req.get('host'),
							utils: utils,
							renderConfig: renderConfig,
							sesion: req.session,
							data: result
						}
					});
				});
			}
		});
	});
	
	/* RUTAS DE ERROR */
	app.get('/error/:id', function(req, res) {
		var id = req.params.id;
		let errordata = {};
		
		//control de errores
		switch(id){
			case "1":
				errordata = {
					code: "404",
					message: "El recurso no se ha encontrado"
				}
				break;
			case "2":
				errordata = {
					code: "403",
					message: "Acceso restringido"
				}
				break;
			case "3":
				errordata = {
					code: "404",
					message: "El tema no existe o ha sido borrado"
				}
				break;
			default:
				errordata = {
					code: "404",
					message: "Error desconocido"
				}
				break;
		}
		
		res.render("error", {
			it : {
					error: errordata,
					kind: req.originalUrl,
					host: req.get('host'),
					utils: utils,
					renderConfig: renderConfig,
					sesion: req.session
				}
		});
	});
	
	/* FALLBACK DE COMPATIBILIDAD CON LINKS VIEJOS */
	//TODO: buscar otra manera mas optima.
	app.get('/tema/:bid', function(req, res) {
		let bid = req.params.bid;
		//buscar la categoria del tema? mameta
		dbManager.queryDB(req.app.locals.db, mdbScheme.C_BOXS, {bid: bid}, "", function(boxs){
			if (boxs[0]){
				res.redirect("/" + boxs[0].cat + "/" + bid);
			} else {
				res.redirect("/old/" + bid);
			}
		});
	});
	
	/* RUTA DE LOS BOXS */
	app.get('/:cat/:bid', function(req, res) {
		var uid = req.session.uid;
		var bid = req.params.bid;
		let cat = req.params.cat;
		
		if (bid){
			dbManager.mQuery(req.app.locals.db, models.BOX_QUERY(uid, bid), function(result){
				//si existe el box, el C_BOXS tendrá datos, de lo contrario se asume que el tema no existe.
				if (!result[mdbScheme.C_BOXS][0]){
					res.redirect("/error/3");
				} else {
					res.render("box", {
						it : {
							kind: "/tema/" + result[mdbScheme.C_BOXS][0].cat,
							host: req.get('host'),
							token: utils.randomString(16),
							utils: utils,
							renderConfig: renderConfig,
							sesion: req.session,
							data: result
						}
					});
				}
			});
		} else {
			res.redirect("/error/1");
		}
	});
	
	app.get('*', function(req, res) {
		//placeholder del control de errores.
		res.status(404);
		res.redirect("/error/1");
	});
	
}