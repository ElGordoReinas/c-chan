const COMMENT_SCHEME = {
	version: 2,
	cid: "cid",
	bid: "bid",
	user: {
		uid: "uid",
		jerarquia: {
			
		}
	},
	type: [],
	flag: [],
	date: {
		created: 0
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
		body: "content",
		extra: {
			tags: []
		}
	}
}

const BOX_SCHEME = {
	version: 2, //variable indicativa de la version del modelo de la base de datos. Utilizada para añadir compatibilidad con versiones antiguas y no tener que borrar todo a la mrd.
	bid: "bid",
	cat: "cat",
	user: {
		uid: "uid",
		jerarquia: {} //datos incrustados de jerarquia.
	},
	type: [], //poll, dice, video, object
	flag: [],
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
		body: "content",
		comments: 0, //se incrusta una referencia de la cantidad de comentarios en el box.
		extra: { //datos especiales dependiendo del tipo de box.
			title2: "", //segundo titulo, caracteristica unica de mikanchan
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

module.exports = {COMMENT_SCHEME, BOX_SCHEME}