const sConfig = require('./config/serverConfig');
const dbManager = require('./db/dbManager');
const mdbScheme = require('./db/models/mdbScheme');
const utils = require('./utils');

module.exports = function(app, DB){
	
	//MUESTRA: crea un nuevo box.
	//PRUEBA PRELIMINAR
	app.post('/api/new', function(req, res) {
		let cat = req.fields.cat;
		let title = req.fields.title;
		let content = req.fields.content;
		let time = Date.now();
		let bid = utils.uuidv4();
		
		let json = {
			bid: bid,
			cat: cat,
			user: {
				uid: req.session.id,
				jerarquia: ""
			},
			type: [],
			flag: [],
			date: {
				created: time,
				bump: time,
				sticky: 0,
				csticky: 0
			},
			img: {
				preview: "/assets/logo.png",
				full: "/assets/logo.png", 
				raw: ""
			},
			media: {
				preview: "",
				raw: ""
			},
			content: {
				title: title,
				body: content,
				comments: 0,
				extra: {
					
				}
			}
		};
		
		dbManager.insertDB(DB, "boxs", json, function(){
			res.redirect("/tema/" + bid);
		});
		
	});
	
	app.post('/api/com', function(req, res) {
		let bid = req.fields.bid;
		let content = req.fields.content;
		let data = req.fields.data;
		
		console.log(data);
		
		let json = {
			cid: utils.genCID(7),
			bid: bid,
			user: {
				uid: req.session.id,
				jerarquia: ""
			},
			type: [],
			flag: [],
			date: {
				created: Date.now()
			},
			icon: "/assets/anon/1.png",
			img: {
				preview: "",
				full: "",
				raw: ""
			},
			media: {
				preview: "",
				raw: ""
			},
			content: {
				body: content,
				extra: {
					tags: []
				}
			}
		};
		dbManager.insertDB(DB, "coms", json, function(){
			res.redirect("/tema/" + bid);
		});
		
	});
	
	//MUESTRA: obtener todos los boxs, ordenados por ultimo bump y stickys
	//TODO: añadir filtro de datos
	app.get('/api/boxs', function(req, res) {
		dbManager.queryDB(DB, mdbScheme.C_BOXS, "", {sticky: -1, bump: -1}, function(boxs){
			if (boxs[0] != undefined){
				res.json({success: true, data: boxs});
			} else {
				res.json({success: false, data: null});
			}
		});
	});
	
	//MUESTRA: obtener box especificado con el bid.
	app.get('/api/box/:bid', function(req, res) {
		let bid = req.params.bid;
		dbManager.queryDB(DB, mdbScheme.C_BOXS, {bid: bid}, {sticky: -1, bump: -1}, function(boxs){
			if (boxs[0] != undefined){
				res.json({success: true, data: boxs});
			} else {
				res.json({success: false, data: null});
			}
		});
	});
	
	//MUESTRA: obtener todos los comentarios
	//TODO: añadir filtro de datos
	app.get('/api/coms', function(req, res) {
		dbManager.queryDB(DB, mdbScheme.C_COMS, "", {tiempo: -1}, function(coms){
			if (coms[0] != undefined){
				res.json({success: true, data: coms});
			} else {
				res.json({success: false, data: null});
			}
		});
	});
	
	//MUESTRA: obtener todos los comentarios en base al bid
	//TODO: añadir filtro de datos
	app.get('/api/coms/:bid', function(req, res) {
		let bid = req.params.bid;
		dbManager.queryDB(DB, mdbScheme.C_COMS, {bid: bid}, {tiempo: -1}, function(coms){
			if (coms[0] != undefined){
				res.json({success: true, data: coms});
			} else {
				res.json({success: false, data: null});
			}
		});
	});
	
	//MUESTRA: obtener comentario especificado con el cid
	app.get('/api/com/:cid', function(req, res) {
		let cid = req.params.cid;
		dbManager.queryDB(DB, mdbScheme.C_COMS, {cid: cid}, {tiempo: -1}, function(coms){
			if (coms[0] != undefined){
				res.json({success: true, data: coms});
			} else {
				res.json({success: false, data: null});
			}
		});
	});
	
	//DEBUG: MUESTRA DE LA ESTRUCTURA DE LOS TEMAS EN MIKANDBV2
	//SOLO PARA DEBUG Y TEST, ESTO LO VOY A SACAR
	app.get('/dev', function(req, res) {
		
		let data = {
			bid: utils.uuidv4(),
			cat: "oficial",
			user: {
				uid: "uid",
				jerarquia: "" //datos incrustados de jerarquia.
			},
			type: [ //poll, dice, video, object
				"poll"
			],
			flag: [ //rss
				"rss"
			],
			date: {
				created: 0, //timestamp de fecha de creacion.
				bump: 0, //timestamp de ultimo bump.
				sticky: 0, //me olvide de añadir estos..
				csticky: 0
			},
			img: {
				preview: "/assets/logo.png", //version optimizada de la imagen para uso como thumbnail.
				full: "/assets/logo.png", //imagen original subida en un servidor local.
				raw: "" //imagen original del sitio procedente, si existe.
			},
			media: {
				preview: "", //thumbnail del video/multimedia
				raw: "" //link directo al video/multimedia
			},
			content: { //contenido del tema.
				title: "title",
				body: "contenido",
				comments: 0, //se incrusta una referencia de la cantidad de comentarios en el box.
				extra: { //datos especiales dependiendo del tipo de box.
					title2: "title2", //segundo titulo, caracteristica unica de mikanchan
					poll: { //datos extra perteneciente a una encuesta.
						pollOne: "opcion 1",
						pollOneV: 0,
						pollTwo: "opcion 2",
						pollTwoV: 0,
						pollVotes: [ //los votos de la encuesta se almacenan en el mismo box.
							["uid", 1],
							["uid", 2]
						]
					}
				}
			}
		};
		dbManager.insertDB(DB, "boxs", data, function(){
			res.redirect("/");
		});
		
	});
	
}