"use strict";
(function () {
  var KEY = "blackhole_data_v1";

  function load() {
    try {
      return Object.assign({
        playlists: [],
        recentTracks: [],
        liked: [],
        gameFavs: [],
        openTabs: [],
        musicVolume: 0.9
      }, JSON.parse(localStorage.getItem(KEY) || "{}"));
    } catch (e) {
      return { playlists: [], recentTracks: [], liked: [], gameFavs: [], openTabs: [], musicVolume: 0.9 };
    }
  }

  function save(data) {
    try {
      localStorage.setItem(KEY, JSON.stringify(data));
    } catch (e) {}
  }

  function update(fn) {
    var d = load();
    fn(d);
    save(d);
    return d;
  }

  window.BlackholeData = {
    load: load,
    save: save,
    update: update,
    addRecent: function (track) {
      return update(function (d) {
        d.recentTracks = [track].concat((d.recentTracks || []).filter(function (t) {
          return t.id !== track.id;
        })).slice(0, 40);
      });
    },
    toggleLike: function (track) {
      return update(function (d) {
        var exists = (d.liked || []).some(function (t) { return t.id === track.id; });
        d.liked = exists
          ? d.liked.filter(function (t) { return t.id !== track.id; })
          : [track].concat(d.liked || []);
      });
    },
    isLiked: function (id) {
      return (load().liked || []).some(function (t) { return t.id === id; });
    },
    savePlaylist: function (pl) {
      return update(function (d) {
        var list = d.playlists || [];
        var i = list.findIndex(function (p) { return p.id === pl.id; });
        if (i >= 0) list[i] = pl;
        else list.unshift(pl);
        d.playlists = list;
      });
    },
    deletePlaylist: function (id) {
      return update(function (d) {
        d.playlists = (d.playlists || []).filter(function (p) { return p.id !== id; });
      });
    },
    saveTabs: function (tabs) {
      return update(function (d) { d.openTabs = tabs || []; });
    },
    addGameFav: function (g) {
      return update(function (d) {
        d.gameFavs = [g].concat((d.gameFavs || []).filter(function (x) { return x.file !== g.file; })).slice(0, 100);
      });
    }
  };
})();
