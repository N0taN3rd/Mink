var debug = true;
var iconState = -1;
var tmData;
var maxBadgeDisplay = '999+';
var stillProcessingBadgeDisplay = 'WAIT';
var tabBadgeCount = {}; // Maintain tabId-->count association



var browserActionTitle_viewingMemento = 'Mink - Viewing Memento';
var browserActionTitle_normal = 'Mink - Integrating the Live and Archived Web';

var badgeImages_disabled = {
  '38' : chrome.extension.getURL('images/minkLogo38_disabled.png'),
  '19' : chrome.extension.getURL('images/minkLogo19_disabled.png')
};

var badgeImages_blacklisted = {
  '38' : chrome.extension.getURL('images/minkLogo38_blacklisted.png'),
  '19' : chrome.extension.getURL('images/minkLogo19_blacklisted.png')
};

var badgeImages_noMementos = {
  '38' : chrome.extension.getURL('images/minkLogo38_noMementos2.png'),
  '19' : chrome.extension.getURL('images/minkLogo19_noMementos2.png')
};

var badgeImages_mink = {
  '38' : chrome.extension.getURL('images/minkLogo38.png'),
  '19' : chrome.extension.getURL('images/minkLogo19.png')
};

var badgeImages_disabled = {
  '38' : chrome.extension.getURL('images/minkLogo38_disabled.png'),
  '19' : chrome.extension.getURL('images/minkLogo19_disabled.png')
};

var badgeImages_isAMemento = {
  '38' : chrome.extension.getURL('images/mLogo38_isAMemento.png'),
  '19' : chrome.extension.getURL('images/mLogo19_isAMemento.png')
};


/*
chrome.webNavigation.onCommitted.addListener(function(e) {
    if(e.frameId !== 0) { // Not main frame
      return;
    }
    console.log("StartingX");
 

	 chrome.runtime.sendMessage({
	   'method': 'startMinkExecution'
	 });
   
    
    //displayUIBasedOnContext();
});*/


chrome.browserAction.onClicked.addListener(function(tab) {
    var scheme = (new URL(tab.url)).origin.substr(0, 4);
    if(scheme !== 'http') {
      if(debug){console.log('Invalid scheme for Mink: ' + scheme);}
      return;
    }

    // Check if isA Memento
    chrome.storage.local.get('timemaps', function(items) {
        console.log('waiting 2?');
        console.log('TODO: check if Memento-Datetime is set here in the cache. Just TMs being present in the cache is not indicative of this being a memento. Related to Issue #150.');
                
        if(items.timemaps && items.timemaps[tab.url]) {
	        console.log('Clicked button and we are viewing a memento');
	        displayMinkUI(tab.id);
	        return;
        }else {
	        console.log('No timemap stored in cache for ' + tab.url);
	        showMinkBadgeInfoBasedOnProcessingState(tab.id);
        }
	});
});

function setEnabledBasedOnURIInBlacklist(cb) {
  chrome.tabs.query({active: true}, function(tab) {
    console.log('is URI in blacklist?');
    console.log(tab);
    
    if(cb) {cb();}
  });


}

function showMinkBadgeInfoBasedOnProcessingState(tabid) {
	chrome.storage.local.get('disabled',function(items) {
		if(items.disabled) {
		  stopWatchingRequests();
		  //TODO: show alternate interface
		  return;
		}
				
		var cb = function() {setBadgeTextBasedOnBrowserActionState(tabid);};
		
		//TODO: check if URI is in blacklist
		console.warn('about to call setEnabledBasedOnURIBlacklist');
		setEnabledBasedOnURIInBlacklist(cb);       
	});
}

function setBadgeTextBasedOnBrowserActionState(tabid) {
	//TODO: This should not rely on the badge count to detect zero mementos, as badges are no longer used for no mementos present
	// - maybe rely on the title, since the icon's src path cannot be had.
	chrome.browserAction.getBadgeText({tabId: tabid}, function(result) {
	  if(!result.length && !Number.isInteger(result) && result != maxBadgeDisplay) {		  
		  chrome.browserAction.getTitle({tabId: tabid}, function(result) {
			// Only set badge text if not viewing a memento
			if(result !== browserActionTitle_viewingMemento) {
			  setBadgeText(stillProcessingBadgeDisplay, tabid);
			} else {
			  console.log('Show "Viewing Memento" Mink UI in page content.');
			}
		  });
					  

		  return; // Badge has not yet been set
	  }
	  displayMinkUI(tabid);
  
	});
}

function displayMinkUI(tabId) {
  console.log('Injecting displayMinkUI.js');
  chrome.tabs.executeScript(tabId, {code: "var tmData = " + JSON.stringify(tmData) + "; var tabId = " + tabId + ";"}, 
    function() {
	  chrome.tabs.executeScript(tabId, {
	  // TODO: Account for data: URIs like the "connection unavailable" page.
	  //   Currently, because this scheme format is not in the manifest, an exception is   
	  //     thrown. Handle this more gracefully.
		file: "js/displayMinkUI.js"
	  }, function(res) {
	    console.log('mink ui injected. res = ');
	    console.log(res);
	  });
  });

}


chrome.runtime.onMessage.addListener(
  function(request, sender, sendResponse) {
    if (request.method == 'store') {
    	localStorage.setItem('minkURI',request.value);
    	localStorage.setItem('mementos',request.mementos);
		localStorage.setItem('memento_datetime',request.memento_datetime);

    	sendResponse({value: 'noise'});
    } else if (request.method == 'retrieve'){
    	if(debug){console.log('Retrieving items from localStorage');}

      sendResponse({
        value: localStorage.getItem('minkURI'),
        mementos: localStorage.getItem('mementos'),
        memento_datetime: localStorage.getItem('memento_datetime')
      });
    } else if (request.method == 'retrieveFromLocalStorage'){
    	if(debug){console.log('Retrieving items from localStorageX');}

      sendResponse({
        value: localStorage.getItem('minkURI'),
        mementos: localStorage.getItem('mementos'),
        memento_datetime: localStorage.getItem('memento_datetime')
      });
    }else if (request.method == 'nukeFromOrbit') {
    	localStorage.removeItem('minkURI');
    }else if (request.method == 'fetchTimeMap') {
      console.log('received message for method = fetchTimemap, value:');
      console.log(request.value);
      fetchTimeMap(request.value, sender.tab.id);
    }else if (request.method == 'notify') {
		  var notify = chrome.notifications.create(
			  'id1',{
				  type:'basic',
				  title:request.title,
				  message:request.body,
				  iconUrl: 'images/icon128.png'
			  },function() {}
		   );
    }else if (request.method == 'refreshAggregatorTimeMap') {
      var refreshAggregatorTimeMapURI = request.value;
      $.ajax({
        method: 'HEAD',
        url: refreshAggregatorTimeMapURI,
        beforeSend: function(request) {
          request.setRequestHeader('cache-control', 'no-cache	')
        }
      }).done(function(data, textStatus, xhr) {
          if (debug) {
            console.log('success');
            console.log(data);
          }
      }).fail(function(xhr, textStatus, error) {
          if (debug){
            console.log('failed');
            console.log(error);
            console.log(textStatus);
          }
      });
    }else if(request.method == 'startSpinningActionButton') {
        console.log('starting animation.....');
        iconState = 0;
        setTimeout(nextAnimationStep, 250);
        /*chrome.tabs.getSelected(null, function (tab) {
		  chrome.tabs.sendMessage(tab.id, {
            "method": 'changeIcon'
           });
		});*/
        
        
    }else if(request.method == 'setBadgeText') {
        setBadgeText(request.value, sender.tab.id)

        sendResponse({
          value: 'stopAnimation'
        });
    }else if(request.method == 'setDropdownContents') {
      tmData = request.value;
    }else if(request.method == 'setBadge') {
        setBadge(request.text, request.iconPath, sender.tab.id);
    }else if(request.method === 'openOptionsPage') {
      console.log('opening options page');
      chrome.runtime.openOptionsPage();
    }else if(request.method == 'stopWatchingRequests') {
      stopWatchingRequests()
    }else if(request.method == 'stopWatchingRequests_blacklisted') {
      stopWatchingRequests_blacklisted()
    }else if(request.method == 'getMementosForHTTPSSource') {
    	//ideally, we would talk to an HTTPS version of the aggregator,
    	// instead, we will communicate with Mink's bg script to get around scheme issue
    	var uri = 'http' + request.value.substr(4);
		  $.ajax({
			  url: uri,
			  type: 'GET'
		  }).done(function(data,textStatus,xhr){
			  if(debug){
				  console.log('We should parse and return the mementos here via a response');
				  //console.log(data);
			  }
			  chrome.tabs.query({
				  'active': true,
				  'currentWindow': true
			  }, function (tabs) {
				  chrome.tabs.sendMessage(tabs[0].id, {
					  'method': 'displayThisMementoData',
					  'data': data
				  });
			  });

	  	}).fail(function(xhr,textStatus,error){
			  if(debug){
			  	//console.log('There was an error from mink.js');
			  	//console.log(textStatus);
			  	//console.log(error);
			  }
		  	if(error == 'Not Found'){
				//console.log('We have '+[].length+' mementos from the call to the archives using an HTTPS source!');
				hideLogo = true;
				showArchiveNowUI();
			}

		});
    }else if(request.method === 'minkUICreated') {
      console.log('**** mink ui created');
    }else {
      if(debug){console.log('Message sent using chrome.runtime not caught: ' + request.method);}
    }
  }
);

function fetchTimeMap(uri, tabid) {
    console.log('in fetchTimeMap with params:');
    console.log('* uri: ' + uri);
    console.log('* tab id: ' + tabid);
	$.ajax({
		url: uri,
		type: "GET"
	}).done(function(data,textStatus,xhr,a,b){ 
      var numberOfMementos = xhr.getResponseHeader('X-Memento-Count');
      tmData = data;
      if(debug) {
        console.log('TODO: set chrome.storage cached TM here');
        console.log('in ajax -- tab id = ' + tabid);
      }
      displaySecureSiteMementos(data.mementos.list, tabid);
      // TODO: set cache here
      //chrome.storage.local.set({'timemaps':tms},function(bytesUsed) {
      setTimemapInStorage(tmData, uri);
      
      
	}).fail(function(xhr, data, error){
	  if(xhr.status === 404) {
		if(debug){console.log('querying secure FAILED, Display zero mementos interface');}
		showInterfaceForZeroMementos(tabid);
		return;
	  }
	  if(debug){console.log('Some error occurred with a secure site that was not a 404');console.log(xhr);}
	}).always(function() {
	  chrome.tabs.sendMessage(tabid, {
	      'method': 'stopAnimatingBrowserActionIcon'
	  });
	});
}

function setLocalStorage(){}

function setBadgeText(value, tabid) {
	var badgeValue = value;

	if(parseInt(badgeValue) > 999) {
			badgeValue = maxBadgeDisplay;
	}

    // Cache query data for eventually restoring when back button is hit (UNIMPLEMENTED)
	//chrome.tabs.get(tabid, function(tab) {
	//	tabBadgeCount['tab' + tabid] = {mementoCount: value, url: tab.url};
	//}); 
	
	var badgeColor = "#090";
	if(value === stillProcessingBadgeDisplay) {
	    badgeColor = "#900"
	}
	
	chrome.browserAction.setBadgeText({text: badgeValue + '', tabId: tabid});
	chrome.browserAction.setBadgeBackgroundColor({color: badgeColor, tabId: tabid});
}

function setBadgeIcon(icons, tabid) {
    /*console.log('setting '+iconPath+ ' tab:'+tabid);
	
	var img = document.createElement('img');
	img.width = 38;
	img.height = 38;
	img.src = iconPath;
	var canvas = document.createElement('canvas');
	canvas.width = 38;
	canvas.height = 38;
	var context = canvas.getContext('2d');
	context.drawImage(img, 0, 0, 38, 38);
	
	chrome.browserAction.setIcon({tabId: tabid,
	  imageData: {'38': context.getImageData(0, 0, 38, 38)}
	});*/
    console.log('in setBadgeIcon, params:');
    console.log(tabid);
    console.log(icons);
    chrome.browserAction.setIcon({tabId: tabid, path: icons}); 
}

function setBadge(value, icon, tabid) {
    if(value === '') {
      chrome.browserAction.getBadgeText({tabId: tabid}, function(currentBadgeText) {
        setBadgeText(currentBadgeText + '', tabid);
      });
    }else {
      setBadgeText(value + '', tabid);
    }
    
    console.log('setting badge icon');
    setBadgeIcon(icon, tabid);
    
    if(icon === badgeImages_isAMemento) {
      chrome.browserAction.setTitle({title: browserActionTitle_viewingMemento});
    }else {
      chrome.browserAction.setTitle({title: browserActionTitle_normal});
    }
}


chrome.contextMenus.create({
	"title": "Hide Mink until reload",
	"contexts": ["image"],
	"onclick" : hideMinkUI
});

function nextAnimationStep() {
	  if(iconState <= 0) {
		//chrome.pageAction.setIcon({tabId: tab.id, path: {'19':'images/mementoLogo-19px-37_5'}});
		iconState = 1;
		console.log('1');
	  }else if(iconState == 1) {
		//chrome.pageAction.setIcon({tabId: tab.id, path: {'19':'images/mementoLogo-19px-45.png'}});  
		iconState = 2;
		console.log('2');
	  }else {
		//chrome.pageAction.setIcon({tabId: tab.id, path: {'19':'images/mementoLogo-19px-30.png'}}); 
		iconState = 0;
		console.log('0');
	  }
	  
	  if(iconState == -1){ return;}
	  //setTimeout(nextAnimationStep, 250);
}

function hideMinkUI(){
 	chrome.tabs.query({
        "active": true,
        "currentWindow": true
    }, function (tabs) {
        chrome.tabs.sendMessage(tabs[0].id, {
            "method": "hideUI"
        });
    });
}

chrome.tabs.onActivated.addListener(function(activeTabInfo) {
  chrome.storage.local.get('disabled',function(items) {
    if(items.disabled) {
      stopWatchingRequests();
    }
  });
});




function startWatchingRequests() {
  chrome.storage.local.remove('disabled', function() {
	  chrome.contextMenus.update('mink_stopStartWatching', {
		  'title': 'Stop Watching Requests',
		  'onclick': stopWatchingRequests
	  });
	  
      chrome.tabs.query({active: true}, function(tab) {
        setBadge('', badgeImages_mink, tab[0].id);
        setBadgeText('', tab[0].id);
      });
  });
}

function stopWatchingRequests() {
  if(debug){console.log('stopWatchingRequests() executing');}
  chrome.storage.local.set({'disabled': true}, function() {        
	  chrome.contextMenus.update('mink_stopStartWatching', {
		  'title': 'Restart Live-Archived Web Integration',
		  'onclick': startWatchingRequests
	  });
      
      chrome.tabs.query({active: true}, function(tab) {
        setBadge(' ', badgeImages_disabled, tab[0].id);
        setBadgeText('', tab[0].id);
      });
	  
	  // Without an id, the current tab's badge won't be updated
	  //chrome.tabs.getCurrent(function(tab) {
	  //    setBadge(' ', chrome.extension.getURL('images/minkLogo38_disabled.png'), tab.id);
	  //});
  });
}

function stopWatchingRequests_blacklisted() {
  if(debug){console.log('stopWatchingRequests_blacklisted() executing');}
  
  
  chrome.tabs.query({active: true}, function(tab) {
	setBadge(' ', badgeImages_blacklisted, tab[0].id);
	setBadgeText('', tab[0].id);
  });

}



chrome.contextMenus.create({
    'id': 'mink_stopStartWatching',
	'title': 'Stop Watching Requests',
	'contexts': ['browser_action'],
	'onclick' : stopWatchingRequests
},function(err){
  if(err){console.log('error creating second contextmenu');}
});


chrome.contextMenus.create({
	'title': 'Add URL to Mink Blacklist',
	'contexts': ['browser_action', 'image'],
	'onclick' : addToBlackList
});

function addToBlackList(){
 	chrome.tabs.query({
        'active': true,
        'currentWindow': true
    }, function (tabs) {
        chrome.tabs.sendMessage(tabs[0].id, {
            'method': 'addToBlacklist',
            'uri': tabs[0].url
        });
    });
}

function nukeBlacklistCache(){
  chrome.storage.local.clear();
  console.log('chrome.storage.local cleared');
}

function nukeLocalStorage(){
  chrome.storage.local.clear();
  console.log('chrome.storage.local cleared');
}

function showArchiveNowUI(){
 	chrome.tabs.query({
        'active': true,
        'currentWindow': true
    }, function (tabs) {
        chrome.tabs.sendMessage(tabs[0].id, {
            'method': 'showArchiveNowUI'
        });
    });
}

function getMementosForHTTPSWebsite(){
 	chrome.tabs.query({
        'active': true,
        'currentWindow': true
    }, function (tabs) {
        chrome.tabs.sendMessage(tabs[0].id, {
            'method': 'getMementosFromSecureSource'
        });
    });
}

chrome.webRequest.onCompleted.addListener(function(deets){
   console.log('*************');

    chrome.tabs.query({
        'active': true,
        'currentWindow': true
    }, function (tabs) {
        chrome.tabs.sendMessage(tabs[0].id, {
            'method': 'displayUI'
        });
    });
},
{urls: ['*://twitter.com/*/status/*'],types: ['xmlhttprequest']},['responseHeaders']);

chrome.webRequest.onHeadersReceived.addListener(function(deets) {
	var url = deets.url;
	var timemap, timegate, original, url;

	var headers = deets.responseHeaders;
	var mementoDateTimeHeader;
	var linkHeaderAsString;
	
	// Enumerate through the HTTP response headers to grab those related to Memento (if applicable)
	for(var headerI = 0; headerI < headers.length; headerI++){
		if(headers[headerI].name == 'Memento-Datetime'){
			mementoDateTimeHeader = headers[headerI].value;
		}else if(headers[headerI].name == 'Link'){
			linkHeaderAsString = headers[headerI].value;
		}
	}
    
	if(linkHeaderAsString) {
	    console.log('A link header exists:');
	    console.log(linkHeaderAsString);
		var tm = new Timemap(linkHeaderAsString);
		if(mementoDateTimeHeader){
			tm.datetime = mementoDateTimeHeader;
		}


        console.log('calling setTimemapInStorage with:');
        console.log(url);
        console.log(tm);
		setTimemapInStorage(tm, url);
	} else if(debug) {
	  console.log('The current page did not send a link header');
	}
	
	
},
{urls: ['<all_urls>'],types: ['main_frame']},['responseHeaders', 'blocking']);


function setTimemapInStorage(tm, url) {
	chrome.storage.local.get('timemaps', function(items) {
		var tms;
		var originalURI;
		if(tm.origin_uri) {
		  originalURI = tm.original_uri;
		}else if(tm.original) {
		  originalURI = tm.original;
		}
		
		
		if(!items.timemaps) {
			tms = {};
		}else {
			tms = items.timemaps;
		}
		tms[url] = tm;
		
		// Trim the cache if overfull
		if(items.timemaps) {
			console.warn('******* Number of cached TMs:');
			var cachedTMKeys = Object.keys(items.timemaps);
			if(cachedTMKeys.length > 10) { // Keep the cache to a reasonable size through random deletion
			  var indexToRemove = Math.floor(Math.random() * cachedTMKeys.length);
			  var keyOfIndex = cachedTMKeys[indexToRemove];
			  delete tms[keyOfIndex];
			}
        }
        
		console.log('Setting chrome.storage.local: timemaps: ');
		console.log(url);
		console.log(tms);
		console.log('original uri?');
		console.log(tm);
		
		chrome.storage.local.set({'timemaps':tms}, function() {
			console.warn('chrome.storage.local.setting');
			
			chrome.storage.local.get('timemaps', function(res) {
			  console.log('here is the current state of the cache after setting');
			  console.log(res);
			});
			chrome.storage.local.getBytesInUse('timemaps', function(bytesUsed) {
			  console.log('current bytes used:' + bytesUsed);
			});
			if(chrome.runtime.lastError) {
				console.log('There was an error last time we tried to store a memento ' + chrome.runtime.lastError.message);
				if(chrome.runtime.lastError.message.indexOf('QUOTA_BYTES_PER_ITEM') > -1) {
					// Chicken wire and duct tape! Clear the cache, do it again, yeah!
					console.warn('LOCALSTORAGE full! clearing!');
					chrome.storage.local.clear();
					console.log('Re-setting chrome.storage.local with:');
					console.log(tms);
					chrome.storage.local.set({'timemaps':tms},function(){});
				}
			}
		});
	});
}



function displaySecureSiteMementos(mementos, tabid){
  setBadge(mementos.length, badgeImages_mink, tabid);
}


function showInterfaceForZeroMementos(tabid) {
  console.log('Displaying zero mementos');
  tmData = {};
  tmData.mementos = {};
  tmData.mementos.list = [];
  tmData.original_uri = 'doWeKnowThisHere';
  
  
  // TODO: Also set the badge icon to the red memento icon (or something else indicative)
  setBadgeText('', tabid);
  setBadgeIcon(badgeImages_noMementos, tabid);  
}

/* Duplicate of code in content.js so https URIs can be used to query timemaps.
   Is there a reason that the below should even be in content.js? 
function getMementosWithTimemap(uri, tabid){
    var memgator_json = 'http://memgator.cs.odu.edu:1208/timemap/json/';
	var timemaploc = memgator_json + window.location;

    console.log('in getMementosWithTimemap with uri ' + uri + ' and tabid ' +tabid);

	if(uri){
	    if(debug) {
	      console.log('in uri ' + uri);
	    }
		timemaploc = uri; //for recursive calls to this function, if a value is passed in, use it instead of the default, accommodates paginated timemaps
	}


	if(debug){console.log('Mink.js: About to fire off Ajax request for ' + timemaploc);}
	$.ajax({
		url: timemaploc,
		type: 'GET'
	}).done(function(data,textStatus,xhr){
		if(xhr.status == 200){
			if(debug){console.log(data);}
			if(debug){console.log(xhr.getAllResponseHeaders());}
			
			var numberOfMementos = xhr.getResponseHeader('X-Memento-Count');

	         // The MemGator service currently returns a 404 w/ no X-Memento-Count 
	         //    HTTP Header
	         //  Q: Does a 404 cause the above AJAX to invoke this "fail" handler
			if(debug){console.log(numberOfMementos + ' mementos availableX');}
            
			if (numberOfMementos == 0) {
				  if (debug) {console.log('We still need to fetch the TimeMap in mink.js');}
				  revamp_fetchTimeMaps(data.timemap_index, displaySecureSiteMementos);

				  return;
			}
           tmData = data;
           displaySecureSiteMementos(data.mementos.list, tabid);

      return;
		}
	}).fail(function(xhr,textStatus) {
	    // TODO: Handler the scenario when the user does not have an internet connection 
	    //   Also, Timeout from server
	    if(debug) {
	      console.log('we encountered an error');
	      console.log(xhr);
	      console.log(xhr.getResponseHeader('X-Memento-Count'));
	      console.log('fin');
	      return;
	    }
		if(debug){
			console.log('ERROR');
			console.log(textStatus);
			console.log(xhr);
		}
		if(xhr.status == 404){
		console.log('creating new tm ppppp');
      var tm = new Timemap();
      tm.original = uri;

      chrome.tabs.query({
        'active': true,
        'currentWindow': true
      }, function (tabs) {
        chrome.tabs.sendMessage(tabs[0].id, {
          method: 'displaySecureSiteMementos',
          value: tm
        });
      });

			if(debug){console.log('404'); console.log("report no mementos, show appropriate interface");}
		}
	});
}*/

/* Redundant of content.js. Does content.js really need this function? */
function revamp_fetchTimeMaps(tms, cb) {
  if (debug) {console.log('mink.js revamp_fetchTimeMaps()');}
		var tmFetchPromises = [];
		for(var tm = 0; tm < tms.length; tm++){ // Generate Promises
			tmFetchPromises.push(fetchTimeMap(tms[tm].uri));
		}
		if(debug){console.log('Fetching ' + tms.length + ' TimeMaps');}
		Promise.all(tmFetchPromises).then(function(val){
        storeTimeMapData(val);
        var tm = val[0];

        for(var tmI = 0; tmI < val.length; tmI++) {
          Array.prototype.push.apply(tm.mementos.list, val[tmI].mementos.list);
        }

        if(cb) {cb(tm);}
    }).catch(function(e) {
			if(debug){
				console.log('A promise failed: ');
				console.log(e);
			}
		});

		return;
}

/* Redundant of content.js. Does content.js really need this function? */
function storeTimeMapData(arrayOfTimeMaps, cbIn){
	//var cb = cbIn ? cbIn : displayUIBasedOnStoredTimeMapData;
	if(debug){console.log('executing storeTimeMapData with no functionality');}
/*
	chrome.storage.local.set({
			'uri_r': arrayOfTimeMaps[0].original_uri,
			'timemaps': arrayOfTimeMaps
	}); //end set
*/
}
