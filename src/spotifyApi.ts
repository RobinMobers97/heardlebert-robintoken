import { Track } from "./tracks";
import { Simulate } from "react-dom/test-utils";
import play = Simulate.play;

async function fetchAccessToken() {
	const CLIENT_ID = "cb693403b2dd4814afabe873c0646cf5";
	const CLIENT_SECRET = "90a447cd45b14f3e927186bdaf08e189";

	const response = await fetch("https://accounts.spotify.com/api/token", {
		method: "POST",
		headers: {
			Authorization: `Basic ${btoa(CLIENT_ID + ":" + CLIENT_SECRET)}`,
			"Content-Type": "application/x-www-form-urlencoded",
		},
		body: new URLSearchParams({
			grant_type: "client_credentials",
		}),
	});

	if (response.status !== 200) {
		return null;
	}
	const payload = await response.json();

	return payload.access_token;
}

export interface Playlist {
	name: string;
	tracks: Track[];
	snapshot_id: string;
}

export async function fetchAlbumImage(trackId: string): Promise<string> {
	const accessToken = await fetchAccessToken();
	let response = await fetch(`https://api.spotify.com/v1/tracks/${trackId}`, {
		headers: {
			Authorization: `Bearer ${accessToken}`,
		},
	});

	if (response.status !== 200) {
		throw new Error(
			`Unable to fetch playlist (${response.status}): ${response.body}`
		);
	}

	let payload: {
		album: {
			images: {
				url: string;
				height: number;
				width: number;
			}[];
		};
	} = await response.json();

	return payload.album.images[0].url;
}
export async function fetchPlaylist(playlistId: string): Promise<Playlist> {
	const accessToken = await fetchAccessToken();
	let response = await fetch(
		`https://api.spotify.com/v1/playlists/${playlistId}`,
		{
			headers: {
				Authorization: `Bearer ${accessToken}`,
			},
		}
	);

	if (response.status !== 200) {
		throw new Error(
			`Unable to fetch playlist (${response.status}): ${response.body}`
		);
	}
	let payloadFirst: {
		name: string;
		snapshot_id: string;
		tracks: {
			items: {
				added_by: {
					id: string;
				};
				track: {
					id: string;
					artists: {
						name: string;
					}[];
					name: string;
					uri: string;
					album: {
						name: string;
					};
				};
			}[];
			next: string;
			limit: number;
			offset: number;
		};
	} = await response.json();

	const playlist: Playlist = {
		name: payloadFirst.name,
		snapshot_id: payloadFirst.snapshot_id,
		tracks: payloadFirst.tracks.items.map((item) => ({
			artists: item.track.artists.map((artist) => artist.name),
			title: item.track.name,
			uri: item.track.uri,
			album: item.track.album.name,
			addedBy: item.added_by.id,
			id: item.track.id,
		})),
	};

	const localStoragePlaylist = localStorage.getItem(playlistId);

	if (
		localStoragePlaylist &&
		JSON.parse(localStoragePlaylist).snapshot_id === playlist.snapshot_id
	) {
		return JSON.parse(localStoragePlaylist);
	}

	if (payloadFirst.tracks.next) {
		let payload: {
			items: {
				added_by: {
					id: string;
				};
				track: {
					id: string;
					artists: {
						name: string;
					}[];
					name: string;
					uri: string;
					album: {
						name: string;
					};
				};
			}[];
			next: string;
			limit: number;
			offset: number;
		} = payloadFirst.tracks;

		//nicht mehr als 1000 Tracks, api nicht übertreiben

		let i = 0;
		while (payload.next && i < 10) {
			i++;
			response = await fetch(payload.next, {
				headers: {
					Authorization: `Bearer ${accessToken}`,
				},
			});
			payload = await response.json();

			playlist.tracks.push(
				...payload.items.map((item) => ({
					artists: item.track.artists.map((artist) => artist.name),
					title: item.track.name,
					uri: item.track.uri,
					album: item.track.album.name,
					addedBy: item.added_by.id,
					id: item.track.id,
				}))
			);
		}
	}

	localStorage.setItem(playlistId, JSON.stringify(playlist));
	return playlist;
}
