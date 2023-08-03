const path = 'set-operations-for-spotify/';////set-operations-for-spotify/



/* Clear Query Paramaters */

function clearQuery() {
  window.history.replaceState('', document.title, window.location.toString().substring(0, window.location.toString().indexOf('?')));
}



/* Favicon */

const faviconEl = document.querySelector('link[rel="icon"]');
window.matchMedia('(prefers-color-scheme: light)').addEventListener('change', function(event) {
  if (event.matches) {
    faviconEl.href = '/set-operations-for-spotify/tabicon-light.png';
  } else {
    faviconEl.href = '/set-operations-for-spotify/tabicon.png';
  }
});



/*Spotify log in*/

function generateRandomString(length) {
  let text = '';
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  for (let i = 0; i < length; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}

async function generateCodeChallenge(codeVerifier) {
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(codeVerifier),
  );
  return btoa(String.fromCharCode(...new Uint8Array(digest))).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

function generateUrlWithSearchParams(url, params) {
  const urlObject = new URL(url);
  urlObject.search = new URLSearchParams(params).toString();
  return urlObject.toString();
}

function redirectToSpotifyAuthorizeEndpoint() {
  const codeVerifier = generateRandomString(64);

  generateCodeChallenge(codeVerifier).then((code_challenge) => {
    window.localStorage.setItem('code_verifier', codeVerifier);

    // Redirect to example:
    // GET https://accounts.spotify.com/authorize?response_type=code&client_id=77e602fc63fa4b96acff255ed33428d3&redirect_uri=http%3A%2F%2Flocalhost&scope=user-follow-modify&state=e21392da45dbf4&code_challenge=KADwyz1X~HIdcAG20lnXitK6k51xBP4pEMEZHmCneHD1JhrcHjE1P3yU_NjhBz4TdhV6acGo16PCd10xLwMJJ4uCutQZHw&code_challenge_method=S256

    window.location = generateUrlWithSearchParams(
      'https://accounts.spotify.com/authorize',
      {
        response_type: 'code',
        client_id,
        scope: 'user-read-private playlist-read-private playlist-read-collaborative playlist-modify-public',
        code_challenge_method: 'S256',
        code_challenge,
        redirect_uri,
      },
    );

    // If the user accepts spotify will come back to your application with the code in the response query string
    // Example: http://127.0.0.1:8080/?code=NApCCg..BkWtQ&state=profile%2Factivity
  });
}

document.getElementById('login-button').addEventListener('click', redirectToSpotifyAuthorizeEndpoint, false);



/*Spotfiy return from log in*/

function exchangeToken(code) {
  const code_verifier = window.localStorage.getItem('code_verifier');

  fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
    },
    body: new URLSearchParams({
      client_id,
      grant_type: 'authorization_code',
      code,
      redirect_uri,
      code_verifier,
    }),
  }).then(addThrowErrorToFetch).then((data) => {
    processTokenResponse(data);
    // clear search query params in the url
    clearQuery();
  }).catch(handleError);
}

function handleError(error) {
  if (error.error && Object.values(error.error).length >= 2) {
    createToast(Object.values(error.error)[0] + ': ' + Object.values(error.error)[1]);
  } else {
    createToast(error);
  }
  clearQuery();
  console.error(error);
}

async function addThrowErrorToFetch(response) {
  if (response.ok) {
    return response.json();
  } else {
    throw { response, error: await response.json() };
  }
}

function processTokenResponse(data) {
  access_token = data.access_token;
  refresh_token = data.refresh_token;

  const t = new Date();
  expires_at = t.setSeconds(t.getSeconds() + data.expires_in);
  processTokenExpiration(expires_at);

  window.localStorage.setItem('access_token', access_token);
  window.localStorage.setItem('refresh_token', refresh_token);
  window.localStorage.setItem('expires_at', expires_at);

  if (document.getElementById('login')) {
    document.getElementById('login').remove();
  }
  document.getElementById('loggedin').style.display = 'flex';

  // load data of logged in user
  getUserData();
  getUserPlaylists();
}



/*Spotify load user data*/

function processTokenExpiration(date) {
  function refreshToken() {
    return fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
      },
      body: new URLSearchParams({
        client_id,
        grant_type: 'refresh_token',
        refresh_token,
      }),
    }).then(addThrowErrorToFetch).then(processTokenResponse).catch(handleError);
  }
  if (date - new Date().getTime() <= 0) {
    return refreshToken();
  }
  setTimeout(refreshToken, date - new Date().getTime());
  return Promise.resolve();
}

function getSpotifyData(link) {
  return fetch(link, {
    headers: {
      Authorization: 'Bearer ' + access_token,
    },
  }).then(async (response) => {
    if (response.ok) {
      return response.json();
    } else {
      throw await response.json();
    }
  });
}

function getUserData() {
  getSpotifyData('https://api.spotify.com/v1/me').then((data) => {
    document.getElementById('name').innerText = 'Hi, ' + data.display_name;
    userHref = data.href;
  }).catch(handleError);
}

function getUserPlaylists(link = 'https://api.spotify.com/v1/me/playlists') {
  getSpotifyData(link).then((data) => {
    for (const playlistData of data.items) {
      if (playlistData.tracks.total) {
        const playlist = document.createElement('button');
        playlist.classList.add('item');
        const content = document.createElement('div');
        content.classList.add('content');
        content.dataset.id = playlistData.id;
        const art = document.createElement('img');
        art.classList.add('art');
        content.append(art);
        const text = document.createElement('div');
        text.classList.add('text');
        const title = document.createElement('p');
        title.classList.add('title');
        title.innerText = playlistData.name;
        text.append(title);
        if (playlistData.description) {
          const description = document.createElement('p');
          description.classList.add('description');
          description.innerText = playlistData.description;
          text.append(description);
        }
        content.append(text);
        const a = document.createElement('a');
        a.classList.add('link');
        a.href = 'spotify:https://open.spotify.com/playlist/' + playlistData.id;
        a.title = 'Open playlist in Spotify'
        const img = document.createElement('img');
        img.src = path + 'images/spotifyLogo.png';
        img.alt = 'Spotify logo';
        a.append(img);
        content.append(a);
        playlist.append(content);
        document.getElementById('playlists').append(playlist);
        art.addEventListener('load', function() {
          resizeMasonryItem(playlist);
        });
        art.src = (playlistData.images[1] || playlistData.images[0]).url;
        playlist.addEventListener('click', function() {
          const playlistHolder = document.querySelector('.playlistHolder.clicked');
          if (playlistHolder) {
            if (playlistHolder.children[0]) {
              playlistHolder.children[0].remove();
            }
            playlistHolder.append(content.cloneNode(true));
            playlistHolder.classList.remove('clicked');
          }
          document.getElementById('playlistPicker').style.display = 'none';
        });
      }
    }
    //handle next for load more
    const loadMore = document.getElementById('loadMore');
    if (data.next) {
      loadMore.style.display = 'flex';
      loadMore.addEventListener('click', function() {
        getUserPlaylists(data.next);
      }, { once: true });
    } else {
      loadMore.style.display = 'none';
    }
  }).catch(handleError);
}

function getPlaylistLength(id) {
  return getSpotifyData('https://api.spotify.com/v1/playlists/' + id + '/tracks?fields=total').then((data) => {
    return data.total;
  }).catch(handleError);
}

function getPlaylistSongs(id) {
  return getPlaylistLength(id).then((total) => {
    let promises = [];
    for (let i = 0; i < total; i += 50) {
      promises.push(getSpotifyData('https://api.spotify.com/v1/playlists/' + id + '/tracks?fields=items.track.uri&limit=50&offset=' + i).then((data) => {
        return data.items;
      }).catch(handleError));
    }
    return Promise.all(promises).then((data) => {
      return data.reduce(function(arr, row) {
        return arr.concat(row.map(dat => dat.track.uri));
      }, []);
    }).catch(handleError);
  }).catch(handleError);
}

function postSpotifyData(link, data) {
  return fetch(link, {
    method: 'POST',
    headers: {
      Authorization: 'Bearer ' + access_token,
    },
    body: JSON.stringify(data)
  }).then(async (response) => {
    if (response.ok) {
      return response.json();
    } else {
      throw await response.json();
    }
  });
}

function postSpotifyPlaylist(name, description) {
  return postSpotifyData(userHref + '/playlists', { name: name, description: description + ' Created by Set Operations For Spotify available at https://tylergordonhill.com/set-operations-for-spotify' }).then((data) => {
    return data.id;
  }).catch(handleError);
}

function postSpotifySongs(id, tracks) {
  let promises = [];
  for (let i = 0; i < tracks.length; i += 100) {
    promises.push(postSpotifyData('https://api.spotify.com/v1/playlists/' + id + '/tracks', { uris: tracks.slice(i, i + 100) }).then((data) => {
      return data;
    }).catch(handleError));
  }
  return Promise.all(promises).then((data) => {
    return data;
  }).catch(handleError);
}



/*Spotify run*/

const client_id = '72236ba6e9d740449f9128203ad489f6';
const redirect_uri = 'https://tylergordonhill.com/set-operations-for-spotify'; /// https://tylergordonhill.com/set-operations-for-spotify

let access_token = window.localStorage.getItem('access_token') || null;
let refresh_token = window.localStorage.getItem('refresh_token') || null;
let expires_at = window.localStorage.getItem('expires_at') || null;
let userHref = '';

const args = new URLSearchParams(window.location.search);
const code = args.get('code');

if (code) {
  // we have received the code from spotify and will exchange it for a access_token
  exchangeToken(code);
} else if (access_token && refresh_token && expires_at) {
  // we are already authorized and reload our tokens from localStorage
  document.getElementById('login').remove();
  document.getElementById('loggedin').style.display = 'flex';

  processTokenExpiration(expires_at).then(() => {
    getUserData();
    getUserPlaylists();
  }).catch(handleError);
}

//logout
document.getElementById('logout-button').addEventListener('click', function() {
  window.localStorage.removeItem('access_token');
  window.localStorage.removeItem('refresh_token');
  window.localStorage.removeItem('expires_at');
  window.localStorage.removeItem('code_verifier');
  window.location.reload();
}, false);



/* Masonry */

function resizeMasonryItem(item) {
  if (document.getElementById('playlistPicker').style.display !== 'none') {
    const masonry = document.getElementById('playlists');
    const rowHeight = parseInt(window.getComputedStyle(masonry).getPropertyValue('grid-auto-rows'));
    const rowGap = parseInt(window.getComputedStyle(masonry).getPropertyValue('grid-row-gap'));
    const contentMargin = parseInt(window.getComputedStyle(item).getPropertyValue('margin-top')) + parseInt(window.getComputedStyle(item).getPropertyValue('margin-bottom'));
    const rowSpan = Math.ceil((item.getElementsByClassName('content')[0].getBoundingClientRect().height + rowGap + contentMargin) / (rowHeight + rowGap));
    item.style.gridRowEnd = 'span ' + rowSpan;
  }
}

function resizeAllMasonryItems() {
  const items = document.getElementsByClassName('item');
  for (let i = 0; i < items.length; i++) {
    resizeMasonryItem(items[i]);
  }
}

window.addEventListener('resize', function() {
  resizeAllMasonryItems();
});



/* Toasts */

function createToast(text, permanent = 0, buttonText, onButtonClick, onClose) {
  let div = document.createElement('div');
  div.classList.add('toast');
  function close() {
    div.classList.add('animateout');
    if (onClose) {
      onClose();
    }
    div.addEventListener('animationend', function() {
      div.remove();
    });
  }
  let x = document.createElement('span');
  x.tabIndex = 0;
  x.classList.add('close');
  x.innerHTML = '&times;';
  x.addEventListener('click', close);
  div.appendChild(x);
  let p = document.createElement('p');
  p.innerText = text;
  div.appendChild(p);
  if (onButtonClick) {
    let undo = document.createElement('button');
    undo.innerText = buttonText;
    undo.addEventListener('click', function() {
      onButtonClick();//undo
      div.classList.add('animateout');
      div.addEventListener('animationend', function() {
        div.remove();
      });
    });
    div.appendChild(undo);
  }
  if (!permanent) {
    let timer = setTimeout(close, 6000);
    div.addEventListener('mouseover', function() {
      clearTimeout(timer);
    });
    div.addEventListener('mouseout', function() {
      timer = setTimeout(close, 6000);
    });
  }
  document.getElementById('toasts').appendChild(div);
  div.classList.add('animatein');
  return close;
}



/*Set Operation*/

const playlistHolders = document.getElementsByClassName('playlistHolder');
for (let i = 0; i < playlistHolders.length; i++) {
  playlistHolders[i].addEventListener('click', function() {
    document.getElementById('setOperation').classList.remove('clicked');
    document.getElementById('operationPicker').style.display = 'none';
    const playlistPicker = document.getElementById('playlistPicker');
    if (playlistHolders[i].classList.contains('clicked')) {
      playlistHolders[i].classList.remove('clicked');
      playlistPicker.style.display = 'none';
    } else {
      playlistHolders[-i + 1].classList.remove('clicked');
      playlistHolders[i].classList.add('clicked');
      playlistPicker.style.display = 'flex';
      resizeAllMasonryItems();
    }
  });
}

document.getElementById('setOperation').addEventListener('click', function() {
  const playlistHolders = document.getElementsByClassName('playlistHolder');
  for (let i = 0; i < playlistHolders.length; i++) {
    playlistHolders[i].classList.remove('clicked');
  }
  document.getElementById('playlistPicker').style.display = 'none';
  const operationPicker = document.getElementById('operationPicker');
  if (this.classList.contains('clicked')) {
    this.classList.remove('clicked');
    operationPicker.style.display = 'none';
  } else {
    this.classList.add('clicked');
    operationPicker.style.display = 'flex';
  }
});

const operations = document.getElementsByClassName('operation');
for (let i = 0; i < operations.length; i++) {
  operations[i].addEventListener('click', function() {
    const setOperation = document.getElementById('setOperation');
    while (setOperation.children[0]) {
      setOperation.children[0].remove();
    }
    const clonedNode = operations[i].cloneNode(true);
    clonedNode.removeAttribute('tabindex');
    setOperation.append(clonedNode);
    setOperation.classList.remove('clicked');
    document.getElementById('operationPicker').style.display = 'none';
  });
}

document.getElementById('create').addEventListener('click', async function() {
  const playlist1 = document.getElementById('playlist1');
  const setOperation = document.getElementById('setOperation');
  const playlist2 = document.getElementById('playlist2');
  if (playlist1.children[0].dataset.id && setOperation.children[0].dataset.id && playlist2.children[0].dataset.id) {
    const closeGettingTracks = createToast('Getting tracks', 1);
    Promise.all([getPlaylistSongs(playlist1.children[0].dataset.id), getPlaylistSongs(playlist2.children[0].dataset.id)]).then(([tracks1, tracks2]) => {
      closeGettingTracks();
      let tracks = [];
      let separator = '';
      if (setOperation.children[0].dataset.id === 'difference') {
        tracks = tracks1.filter(x => !tracks2.includes(x))
        separator = '-';
      } else if (setOperation.children[0].dataset.id === 'union') {
        tracks = [...new Set([...tracks1, ...tracks2])];
        separator = '∪';
      } else {
        tracks = tracks1.filter(x => tracks2.includes(x));
        separator = '∩';
      }
      if (!tracks.length) {
        createToast('Empty playlist!');
      } else {
        const closeCreatingPlaylist = createToast('Creating playlist', 1);
        let name1 = playlist1.getElementsByClassName('title')[0].innerText;
        let name2 = playlist2.getElementsByClassName('title')[0].innerText;
        if (name1.includes('-') || name1.includes('∪') || name1.includes('∩')) {
          name1 = '(' + name1 + ')';
        }
        if (name2.includes('-') || name2.includes('∪') || name2.includes('∩')) {
          name2 = '(' + name2 + ')';
        }
        postSpotifyPlaylist(name1 + ' ' + separator + ' ' + name2, 'This is a ' + setOperation.children[0].dataset.id + ' between ' + name1 + ' and ' + name2 + '.').then((playlist) => {
          closeCreatingPlaylist();
          const closeAddingTracks = createToast('Adding tracks', 1);
          postSpotifySongs(playlist, tracks).then(() => {
            closeAddingTracks();
            createToast('Done', 0, 'Open', function() {
              window.open('spotify:https://open.spotify.com/playlist/' + playlist, '_self');
            });
          }).catch(handleError);
        }).catch(handleError);
      }
    }).catch(handleError);
  }
});



/* Google Analytics */

window.dataLayer = window.dataLayer || [];
function gtag() { window.dataLayer.push(arguments); }
gtag("js", new Date());
gtag("config", "G-BVTJ5JS3H2");
