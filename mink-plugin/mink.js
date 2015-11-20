var debug = true;
var iconState = -1;
var tmData;
var maxBadgeDisplay = '999+';
var stillProcessingBadgeDisplay = 'WAIT';
var tabBadgeCount = {}; // Maintain tabId-->count association


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
    // Check if isA Memento
    chrome.storage.sync.get('timemaps', function(items) {
        console.log(items.timemaps);
        if(items.timemaps && items.timemaps[tab.url]) {
	        console.log('CLicked button and we are viewing a memento');
	        return;
         }else {
	        console.log('No timemap for ' + tab.url);
         }

	});



	chrome.storage.sync.get('disabled',function(items) {
		if(items.disabled) {
		  stopWatchingRequests();
		  //TODO: show alternate interface
		  return;
		}

		chrome.browserAction.getBadgeText({tabId: tab.id}, function(result) {
		  if(!result.length && !Number.isInteger(result) && result != maxBadgeDisplay) {		              
			  setBadgeText(stillProcessingBadgeDisplay, tab.id);

			  return; // Badge has not yet been set
		  }
		  displayMinkUI(tab.id);
	  
		});
	});

});

function displayMinkUI(tabId) {
  chrome.tabs.executeScript(tabId, {code: "var tmData = " + JSON.stringify(tmData)}, 
    function() {
	  chrome.tabs.executeScript(tabId, {
	  // TODO: Account for data: URIs like the "connection unavailable" page.
	  //   Currently, because this scheme format is not in the manifest, an exception is   
	  //     thrown. Handle this more gracefully.
		file: "js/displayMinkUI.js"
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

		//TODO: stop spinning
		//stopSpinningActionButton()
		
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
    }else {
      if(debug){console.log('Message sent using chrome.runtime not caught: ' + request.method);}
    }
  }
);

function fetchTimeMap(uri, tabid) {
	$.ajax({
		url: uri,
		type: "GET"
	}).done(function(data,textStatus,xhr,a,b){ 
      var numberOfMementos = xhr.getResponseHeader('X-Memento-Count');
      tmData = data;
      displaySecureSiteMementos(data.mementos.list, tabid);
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

function setBadgeIcon(iconPath, tabid) {
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

    chrome.browserAction.setIcon({tabId: tabid, path: {'38': iconPath}}); 
}

function setBadge(value, icon, tabid) {
    setBadgeText(value + '', tabid);
    setBadgeIcon(icon, tabid);
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
  chrome.storage.sync.get('disabled',function(items) {
    if(items.disabled) {
      stopWatchingRequests();
    }
  });
});




function startWatchingRequests() {
  chrome.storage.sync.remove('disabled', function() {
	  chrome.contextMenus.update('mink_stopStartWatching', {
		  'title': 'Stop Watching Requests',
		  'onclick': stopWatchingRequests
	  });
  
	  setBadge('', chrome.extension.getURL('images/minkLogo38.png'), null);
  });
}

function stopWatchingRequests() {
  if(debug){console.log('stopWatchingRequests');}
  chrome.storage.sync.set({'disabled': true}, function() {        
	  chrome.contextMenus.update('mink_stopStartWatching', {
		  'title': 'Restart Live-Archived Web Integration',
		  'onclick': startWatchingRequests
	  });
  
	  setBadge('', chrome.extension.getURL('images/minkLogo38_disabled.png'), null);
	  // Without an id, the current tab's badge won't be updated
	  //chrome.tabs.getCurrent(function(tab) {
	  //    setBadge(' ', chrome.extension.getURL('images/minkLogo38_disabled.png'), tab.id);
	  //});
  });
}


if(debug) { // Only show contextual menu items in dev for now.
chrome.contextMenus.create({
    'id': 'mink_stopStartWatching',
	'title': 'Stop Watching Requests',
	'contexts': ['browser_action'],
	'onclick' : stopWatchingRequests
},function(err){
  if(err){console.log('error creating second contextmenu');}
});

chrome.contextMenus.create({
	'title': 'Add to Mink Blacklist',
	'contexts': ['image'],
	'onclick' : addToBlackList
	//,'targetUrlPatterns':['*://*/*'] //TODO: filter this solely to the Mink UI
});

chrome.contextMenus.create({
	'title': 'Nuke Blacklist Cache',
	'contexts': ['image'],
	'onclick' : nukeBlacklistCache
	//,'targetUrlPatterns':['*://*/*'] //TODO: filter this solely to the Mink UI
},function(err){
  if(err){console.log('error creating second contextmenu');}
});

chrome.contextMenus.create({
	'title': 'Clear LocalStorage',
	'contexts': ['image'],
	'onclick' : nukeLocalStorage
	//,'targetUrlPatterns':['*://*/*'] //TODO: filter this solely to the Mink UI
},function(err){
  if(err){console.log('error creating second contextmenu');}
});

}

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
  chrome.storage.sync.clear();
  console.log('chrome.storage.sync cleared');
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

chrome.webRequest.onHeadersReceived.addListener(function(deets){
	var url = deets.url;
	var timemap, timegate, original, url;

	var headers = deets.responseHeaders;
	var mementoDateTimeHeader;
	var linkHeaderAsString;
	for(var headerI=0; headerI<headers.length; headerI++){
		if(headers[headerI].name == 'Memento-Datetime'){
			mementoDateTimeHeader = headers[headerI].value;
		}else if(headers[headerI].name == 'Link'){
			linkHeaderAsString = headers[headerI].value;
		}
	}

	if(linkHeaderAsString){
		var tm = new Timemap(linkHeaderAsString);
		if(mementoDateTimeHeader){
			tm.datetime = mementoDateTimeHeader;
		}

		chrome.storage.sync.get('timemaps', function(items) {
		  var tms;
		  if(!items.timemaps) {
		    tms = {};
		  }else {
		    tms = items.timemaps;
		  }
		  tms[url] = tm;
		  
       
		  chrome.storage.sync.set({'timemaps':tms},function(bytesUsed) {
			if(chrome.runtime.lastError) {
			  console.log('There was an error last time we tried to store a memento ' + chrome.runtime.lastError.message);
			  if(chrome.runtime.lastError.message.indexOf('QUOTA_BYTES_PER_ITEM') > -1) {
			    // Chicken wire and duct tape! Clear the cache, do it again, yeah!
			    chrome.storage.sync.clear();
			    chrome.storage.sync.set({'timemaps':tms},function(){});
			  }
			}
			console.log('Bytes used: '+bytesUsed);
		  });

		});

	}
	
	
},
{urls: ['<all_urls>'],types: ['main_frame']},['responseHeaders', 'blocking']);


function displaySecureSiteMementos(mementos, tabid){
  setBadge(mementos.length, chrome.extension.getURL('images/minkLogo38.png'), tabid);
}


function showInterfaceForZeroMementos(tabid) {
  console.log('Displaying zero mementos');
  tmData = {};
  tmData.mementos = {};
  tmData.mementos.list = [];
  tmData.original_uri = 'doWeKnowThisHere';
  
  
  // TODO: Also set the badge icon to the red memento icon (or something else indicative)
  setBadgeText('', tabid);
  setBadgeIcon('images/minkLogo38_noMementos.png', tabid);

  
}

/* Duplicate of code in content.js so https URIs can be used to query timemaps.
   Is there a reason that the below should even be in content.js? */
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
}

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
