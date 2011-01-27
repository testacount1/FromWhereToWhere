//independent of searching/treeview or recommendation
com.wuxuan.fromwheretowhere.historyQuery = function(){
  var pub={};
  
  //sqlite operations:

  pub.openPlacesDatabase = function(){
    var db = Components.classes["@mozilla.org/browser/nav-history-service;1"].  
                      getService(Components.interfaces.nsPIPlacesDatabase).DBConnection;  
    return db;
  };

  pub.mDBConn = pub.openPlacesDatabase();
  pub.ios = Components.classes["@mozilla.org/network/io-service;1"].
	        getService(Components.interfaces.nsIIOService);
  pub.fis = Components.classes["@mozilla.org/browser/favicon-service;1"].
          getService(Components.interfaces.nsIFaviconService);
    
  /*type = 32, getInt32; type = 64, getInt64; type = "str", getString */
  pub.queryAll = function(statement, type, idx) {
    var children = [];
    try {
      while (statement.executeStep()) {
	if(type == "str") {
	  children.push(statement.getString(idx));
	} else if(type == 32){
	  children.push(statement.getInt32(idx));
	} else if(type == 64){
	  children.push(statement.getInt64(idx));
	} else {
	  alert("wrong type: " + type);
	}
      }
      statement.reset();
      return children;  
    } 
    catch (e) {
      statement.reset();
    }
  };
  
  /*type = 32, getInt32; type = 64, getInt64; type = "str", getString */
  pub.queryOne = function(statement, type, idx) {
    var id = null;
    try {
      if (statement.executeStep()) {
	if(type == "str") {
	  if(statement.getIsNull(idx)){
	    id = "";
	  }else{
	    id = statement.getString(idx);
	  }
	} else if(type == 32){
	  id = statement.getInt32(idx);
	} else if(type == 64){
	  id = statement.getInt64(idx);
	} else {
	  alert("wrong type: " + type);
	}
	statement.reset();
	return id;
      }
    } 
    catch (e) {
      statement.reset();
    }
  };
  
  /* the url visited before are all associated with the first place_id */
  pub.getAllIdfromPlaceId = function(pid){
    var statement = pub.mDBConn.createStatement("SELECT id FROM moz_historyvisits where place_id=:pid");
    try{
      statement.params.pid=pid;
    }catch(err){
      alert(err);
    }
    return pub.queryAll(statement, 32, 0);
  };
    
  pub.getChildren = function(parentId, query) {
    //all from_visit between id and next larger id are the same
		var term = "SELECT place_id FROM moz_historyvisits where from_visit>=:id and from_visit< \
						(SELECT id FROM moz_historyvisits where id>:id limit 1)";
		if(query){
			if(query.site.length>0){
				term = pub.sqlStUrlFilter(term, query.site, false);
			}
			if(query.time.length>0){
				term = pub.sqlStTimeFilter(term, query.time, false);
			}
		}
		//alert(term);
    var statement = pub.mDBConn.createStatement(term);
    statement.params.id=parentId;
    return pub.queryAll(statement, 32, 0);
  };
  
  //linear search in array, may improve if in order
  pub.addInArrayNoDup = function(pid, ls){
    if(ls.indexOf(pid)==-1){
      ls.push(pid);
    }
    return ls;
  };
  
  //pub.timestats1=0;
  /* placeId: the placeId of the parent, which is unique even when this url is visited multiple times
    retrievedId: the id of the child, which correspond to the current url only
    TOOPT: use pure SQL instead of concat and dupcheck*/
  pub.getAllChildrenfromPlaceId = function(placeId, query) {
    //var start = (new Date()).getTime();
    var potentialchildren = [];
    /*var statement = pub.mDBConn.createStatement("SELECT place_id FROM moz_historyvisits where from_visit>=thisid and from_visit<\
						(SELECT id FROM moz_historyvisits where id>thisid limit 1) where thisid IN \
						(SELECT id FROM moz_historyvisits where place_id=:pid)");
      statement.params.pid=placeId;*/
    var ids = pub.getAllIdfromPlaceId(placeId);
    
    for(var j = 0; j<ids.length; j++) {
      var newChildren = pub.getChildren(ids[j], query);
      for(var i in newChildren){
	potentialchildren = pub.addInArrayNoDup(newChildren[i], potentialchildren);
      }
    }
    //potentialchildren = pub.queryAll(statement, 32, 0);
    //pub.timestats1+=(new Date()).getTime()-start;
    return potentialchildren;
  };
     
  pub.nodefromPlaceid = function(pid, query) {
    var potentialchildren = pub.getAllChildrenfromPlaceId(pid, query);
    var hasChildren = (potentialchildren!=null) && (potentialchildren.length>0);
    var id = pub.getIdfromPlaceId(pid);
    return pub.ReferedHistoryNode(id, pid, pub.getTitlefromId(pid), pub.getUrlfromId(pid), hasChildren, false, [], 0);
  };
  
  pub.getIdfromUrl = function(url){
    var statement = pub.mDBConn.createStatement("SELECT id FROM moz_places where url=:url");
    if(!url) {
      return null;
    }
    statement.params.url=url;
    return pub.queryOne(statement, 32, 0);
  };
  
  pub.getUrlfromId = function(id){
    var statement = pub.mDBConn.createStatement("SELECT url FROM moz_places where id=:id");
    statement.params.id=id;
    return pub.queryOne(statement, "str", 0);
  };

  pub.getTitlefromId = function(id){
    var statement = pub.mDBConn.createStatement("SELECT title FROM moz_places where id=:id");
    statement.params.id=id;
    return pub.queryOne(statement, "str", 0); 
  };
  
  pub.getLastDatefromPid = function(pid){
    var statement = pub.mDBConn.createStatement("SELECT last_visit_date FROM moz_places where id=:pid");
    statement.params.pid=pid;
    return pub.queryOne(statement, 64, 0);
  };
  
  pub.getIdfromPlaceId = function(pid){
    var statement = pub.mDBConn.createStatement("SELECT id FROM moz_historyvisits \
					    where place_id=:id");
    statement.params.id=pid;
    return pub.queryOne(statement, 32, 0);
  };
  
  pub.getImagefromUrl = function(url){
    try{
      var uri = pub.ios.newURI(url, null, null);
      return pub.fis.getFaviconImageForPage(uri).spec;
    }catch(e){}
  };
  
  pub.searchIdbyKeywords = function(words, excluded, site, time){
    //SELECT * FROM moz_places where title LIKE '%sqlite%';
    //NESTED in reverse order, with the assumption that the word in front is more frequently used, thus return more items in each SELECT
    var term = "";
		
		//add site filter
		var siteTerm = "moz_places";

		if(site.length!=0){
      for(var i = site.length-1; i>=0; i--){
        siteTerm = "SELECT * FROM (" + siteTerm + ") WHERE URL LIKE '%" + site[i] + "%'";
      }
    }
		
		//TODO: seems dup condition, to simplify
    var excludeTerm = siteTerm;
    if(excluded.length!=0){
			var titleNotLike = "";
      for(var i = excluded.length-1; i>=0; i--){
				// no proof to be faster
        /*if(i==excluded.length-1){
					if(i!=0){
						titleNotLike = " TITLE NOT LIKE '%" + excluded[i] + "%' AND" + titleNotLike;
					}
        } else {*/
          excludeTerm = "SELECT * FROM (" + excludeTerm + ") WHERE" + titleNotLike + " TITLE NOT LIKE '%" + excluded[i] + "%'";
        //}
      }
    }
    
    if(words.length==1){
      term = "SELECT id FROM (" + excludeTerm + ") WHERE TITLE LIKE '%" + words[0] + "%'";
    } else {
			var titleLike = "";
      for(var i = words.length-1; i>=0; i--){
				if(i==words.length-1){
          term = "SELECT * FROM (" + excludeTerm + ") WHERE TITLE LIKE '%" + words[i] + "%'";
        } else if(i!=0){
          term = "SELECT * FROM (" + term + ") WHERE TITLE LIKE '%" + words[i] + "%'";
        } else {
          term = "SELECT id FROM (" + term + ") WHERE TITLE LIKE '%" + words[i] + "%'";
        }
				// no proof to be faster
				/*if(i!=0){
					titleLike = " title LIKE '%"+words[i]+"%' AND" + titleLike;
        } else {
          term = "SELECT id FROM (" + excludeTerm + ") WHERE" + titleLike +" TITLE LIKE '%" + words[i] + "%'";
        }*/
      }
    }
		
		if(time.length>0){
			term = pub.sqlStTimeFilter(term, time, false);
			//for(var i = 0; i<time.length;i++)
			//	term = "SELECT place_id FROM moz_historyvisits where place_id in ("+term+") AND visit_date>="+time[i].since*1000+" AND visit_date<" + time[i].till*1000;
		}
		//alert(term);
    var statement = pub.mDBConn.createStatement(term);
    return pub.queryAll(statement, 32, 0);
  };
  //sqlite operations finish
	
	//add url filter for id, TODO: more general than id - moz_places
	//singular_table: true-singular, false-table
	pub.sqlStUrlFilter = function(term, sites, singular_table){
		var fterm = "";
		var idx = sites.length-1;
		for(var i in sites){
			if(i==idx){
				if(true)
					return "SELECT id FROM moz_places WHERE id=("+term+") AND url LIKE '%"+sites[i]+"%'" + fterm;
				else
					return "SELECT id FROM moz_places WHERE id in ("+term+") AND url LIKE '%"+sites[i]+"%'" + fterm;
			}else{
				fterm = fterm + " AND url LIKE '%"+sites[i]+"%'";
			}
		}
	};

	//singular_table: true-singular, false-table
	pub.sqlStTimeFilter = function(term, times, singular_table){
		var fterm = "";
		var idx = times.length-1;
		for(var i in times){
			var t = "";
			var fix = " AND visit_date";
			if(times[i].since!=-1){
				t = fix+">="+times[i].since*1000;
			}
			if(times[i].till!=Number.MAX_VALUE){
				t = t+fix+"<"+times[i].till*1000;
			}
			//if there's no restriction, leave the term as it was
			if(t==""){
				return term;
			}
			if(i==idx){
				if(singular_table)
					return "SELECT place_id FROM moz_historyvisits WHERE place_id=("+term+ ")" + t + fterm + " GROUP BY place_id";
				else
					return "SELECT place_id FROM moz_historyvisits WHERE place_id in ("+term+")" + t + fterm + " GROUP BY place_id";
			}else{
				fterm = fterm + t;
			}
		}
	};
	
	// add query restrictions to parents, time and site
  pub.getParentPlaceidsfromPlaceid = function(pid, query){
    //as id!=0, from_visit=0 doesn't matter
		var term = "SELECT place_id FROM moz_historyvisits \
					    where id IN (SELECT from_visit FROM moz_historyvisits where \
						place_id==:id)";
		//alert(term);
    var statement = pub.mDBConn.createStatement(term);
    statement.params.id=pid;
    var pids = pub.queryAll(statement, 32, 0);
		// IF there's no results, maybe it's inaccurate! REPEAT with range!
		//if(pid==10247)
    if(pids.length==0){
      var statement = pub.mDBConn.createStatement("SELECT from_visit FROM moz_historyvisits where \
						place_id=:id and from_visit!=0");
      statement.params.id=pid;
      var placeids = pub.queryAll(statement, 32, 0);
      if(placeids.length==0){
				return [];
      } else {
				var accPids=[];
				for(var i in placeids){
					var rangeStart = 0;
					var rangeEnd = 10;
					var initInterval = 10;
					//limit the range of "order by". Should break far before 10, just in case
					for(var j=0;j<10;j++){
						var fterm = "SELECT place_id FROM moz_historyvisits \
										where id<=:id-:start and id>:id-:end \
										order by -id limit 1";
						var statement1 = pub.mDBConn.createStatement(fterm);
						statement1.params.id=placeids[i];
						statement1.params.start=rangeStart;
						statement1.params.end=rangeEnd;
						var thispid = pub.queryOne(statement1, 32, 0);
						if(thispid){
							pids.push(thispid);
							break;
						}
						initInterval = initInterval * 3;
						rangeStart = rangeEnd;
						rangeEnd += initInterval;
					}
				}
      }
		}
		//fiter pid after all the keyword query
		if(query && (query.site.length>0 || query.time.length>0)){
			var filtered = [];
			for(var i in pids){
				var fterm = pids[i];
				if(query.site.length>0){
					fterm = pub.sqlStUrlFilter(fterm, query.site, true);
				}
				if(query.time.length>0){
					fterm = pub.sqlStTimeFilter(fterm, query.time, true);
				}
				var statement = pub.mDBConn.createStatement(fterm);
				var thispid = pub.queryOne(statement, 32, 0);
				if(thispid!=null){
					filtered.push(pids[i]);
				}
			}
			return filtered;
		}else{
			return pids;
		}
  };
  
  // Main Datastructure for each Node
  pub.ReferedHistoryNode = function(id, placeId, label, url, isContainer, isFolded, children, level) {
    var obj = new Object();
    obj.id = id;
    obj.placeId = placeId;
    obj.label = label;
    obj.url = url;
    obj.isContainer = isContainer;
    obj.isFolded = isFolded;
    obj.children = children;
    obj.level = level;
    return obj;
  };
  
  pub.clearReferedHistoryNode = function(node){
    for(var i in node.children){
      node.children[i] = pub.clearReferedHistoryNode(node.children[i]);
    }
    node.id = null;
		//placeid is not applicable across profiles, so don't use it for sharing at all!
		node.placeId = null;
		if(node.haveKeywords)
			node.haveKeywords = null;
		if(node.inSite)
			node.inSite = null;
    return node;
  };
  
  pub.allKnownParentPids = [];
  
  //return all the top ancesters of a placeid, and add to allKnownParents
  pub.getAllAncestorsfromPlaceid = function(pid, knownParentPids, parentNumber, query){
    var tops = [];
    //if it's its own ancester, still display it
    if(knownParentPids.indexOf(pid)!=-1){
      //if there's only one parent, the link circle is closed from pid
      if(parentNumber==1){
	tops=pub.addInArrayNoDup(pid,tops);
      }
    }else{
      knownParentPids.push(pid);
      var pParentPids = pub.getParentPlaceidsfromPlaceid(pid, query);
      if(pParentPids.length==0){
        if(pub.allKnownParentPids.indexOf(pid)==-1){
	  pub.allKnownParentPids.push(pid);
        }
        tops.push(pid);
      } else {
	//if multiple ancestors, latest first
	var parentNum = pParentPids.length;
        for(var j=parentNum-1;j>=0;j--){
	  if(pub.allKnownParentPids.indexOf(pParentPids[j])==-1){
	    pub.allKnownParentPids.push(pParentPids[j]);
	    var anc=pub.getAllAncestorsfromPlaceid(pParentPids[j], knownParentPids, parentNum, query);
	    for(var k in anc){
	      tops=pub.addInArrayNoDup(anc[k],tops);
	    }
	  }
        }
      }
    }
    return tops;
  };
  
  // those without parent are also added, can't only highlight the keywords instead of the whole title?
  pub.createParentNodesCheckDup = function(pids,query) {
    pub.allKnownParentPids = [];
    var nodes = [];
    var ancPids = [];
    //order by time: latest first by default
    for(var i=pids.length-1; i>=0; i--){
      var anc = pub.getAllAncestorsfromPlaceid(pids[i],[],0,query);
			//alert("create anc nodes: " + pids[i] + "\n" + anc);
      for(var j in anc){
        ancPids = pub.addInArrayNoDup(anc[j],ancPids);
      }
    }
    for(var i in ancPids){
      nodes.push(pub.nodefromPlaceid(ancPids[i], query));
    }
    return nodes;
  };
  
  return pub;
}();