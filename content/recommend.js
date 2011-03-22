com.wuxuan.fromwheretowhere.recommendation = function(){
  var pub={};
    
  pub.mainWindow = window.QueryInterface(Components.interfaces.nsIInterfaceRequestor)
        .getInterface(Components.interfaces.nsIWebNavigation)
        .QueryInterface(Components.interfaces.nsIDocShellTreeItem)
        .rootTreeItem
        .QueryInterface(Components.interfaces.nsIInterfaceRequestor)
        .getInterface(Components.interfaces.nsIDOMWindow);
 
  pub.DEBUG = true;
  pub.ANCHOR = false;
  pub.DEBUGINFO = "";
  pub.debuginfo = {};
  pub.TOOFEWWORDS = 4
  pub.MULTILINE_LIMIT = 3;
  pub.starttime = 0;
  pub.sqltime = {};
  
  pub.getOrig = function(word){  
    var orig = pub.mapOrigVerb[word];
    //need to check type because array have function like "match, map"
    if((typeof orig)=="string" && orig){
      //alert(word+"->"+orig);
      return orig;
    }
    else
      return word;
  };
  
  //also remove all numbers, as they don't seem to carry much "theme" info
  //remove word.length==1
  pub.filter = function(aw, stopwords, specials){
    var allwords = aw;
    var alloccurrence = [];
    //TODO: for now can't handle mixed languages
    for(var i=0; i<allwords.length; i++){
      allwords[i] = allwords[i].toLowerCase();
      var orig = allwords[i];
      var upper = orig.toUpperCase();
      //judge if it's English
      if(upper!=orig){
        //only for English
        //only get the first part here
        //TODO: should get more words out, split them with the recognized words, expensive though (keep those with special words, and then indexof the recog, split with those, then recurrent)
        allwords[i] = orig.replace(/\W*(\w+)\W*/,"$1");
        //only for English
        allwords[i] = pub.getOrig(allwords[i]);
        if(stopwords.indexOf(allwords[i])>-1 || specials.indexOf(allwords[i])>-1 || allwords[i]=="" || allwords[i].length<=1 || allwords[i].match(/[0-9]/)!=null){
          allwords.splice(i, 1);
          i--;
        }
      }else{//for Chinese
        //get all the parts separated by non-word, for now only consider Eng and Chn
        var parts = orig.split(/[^a-zA-Z\d\.\u4e00-\u9fa5]+/);//(/[~|!|@|#|$|%|^|&|*|(|)|\-|_|+|=|��|:|;|\"|\'|<|>|,|.|?|\/|\\|{|}|[|]|��|��|����|��|��|\||��|����|��|��|��|��|��|��|��|��|��|��|��|��|��]+/);
        var nonempty = parts.filter(function notEmpty(str){return str!="";});
        /*if(pub.DEBUG){
          //alert(allwords + "\n"+allwords[i]);
          alert(parts+"\n"+nonempty);
        }*/
        allwords.splice(i,1);
        if(nonempty.length!=0){
          for(var j=0;j<nonempty.length;j++){
            //remove all numbers and 1 char word
            if(nonempty[j].length==1 || nonempty[j].match(/[0-9]/)!=null){
              continue;
            }
            /*var segs = pub.utils.segmentChn(allwords[i],pub.dictionary);
            if(segs.length>1){
              
            }*/
            allwords.splice(i,0,nonempty[j]);
            i++;
          }
        }
        i--;
      }
    }
    return allwords;
  };
  
  pub.oldfilter = function(aw, stopwords, specials){
    var allwords = aw;
    for(var i=0; i<allwords.length; i++){
      allwords[i] = allwords[i].toLowerCase();
      //stupid way to get rid of special char from the utterance
      //those with , and : -- useful semantic, but for now clean up
      /*for(var j=0;j<specials.length;j++){
        allwords[i]=allwords[i].replace(new RegExp(specials[j],"g"),"");
      }*/
      //if there's \W in the end or start(hp,\ (the) get the first part; (doesn't) leave it as is
      var orig = allwords[i];
      //only get the first part here
      allwords[i] = orig.replace(/\W*(\w+)\W*/,"$1");
        //only for English
        allwords[i] = pub.getOrig(allwords[i]);
        if(stopwords.indexOf(allwords[i])>-1 || specials.indexOf(allwords[i])>-1 || allwords[i]=="" || allwords[i].length<=1 || allwords[i].match(/[0-9]/)!=null){
          allwords.splice(i, 1);
          i--;
        }
    }
    return allwords;
  };
  
  pub.getTopic = function(title, sp, stopwords, specials){
    if(title==null){
      return [];
    }
    //TODO: some language requires more complex segmentation, like CHN
    var allwords = title.split(sp);//(" ");/\W/
    //TODO: if CHN, segment using N-gram, and split the sentence by those same words, to get more words/phrases
    var ws = pub.filter(allwords, stopwords, specials);
    //if(pub.DEBUG)
    //  alert(ws);
    return ws;
  };
  
  /*if the title has too few words (including stopwords), consider as non-informatic*/
  pub.tooSimple = function(allwords, specials){
    var rmSpecials = pub.filter(allwords, [], specials);
    if(rmSpecials.length<pub.TOOFEWWORDS){
      return true;
    }else{
      return false;
    }
  };
  
  /* get titles from all the nodes in the note */
  pub.getAllTitles = function(note, titles){
    if(!titles){
      alert(note.label);
    }
    titles.push(note.label);
    for(var i in note.children){
      titles=titles.concat(pub.getAllTitles(note.children[i],[]));
    }
    return titles;
  };
  
  /* get all the words from the notes that have the keywords, this is abused...need more topic discovery */
  pub.getLocal = function(allwords, stopwords, specials){
    var locals = pub.localmanager.searchNotesbyKeywords([], allwords, [],[]);
    var alltitles = [];
    var allRelated = [];
    for(var i in locals){
      alltitles=alltitles.concat(pub.getAllTitles(locals[i],[]));
    }
    var titleset = [];
    for(var j in alltitles){
      //no repeat titles!
      if(titleset.indexOf(alltitles[j])>-1){
        continue;
      }else{
        titleset.push(alltitles[j]);
      }
      var relatedWords=pub.getTopic(alltitles[j], " ", stopwords, specials);
      allRelated=allRelated.concat(relatedWords);
    }
    return allRelated;
  };
  
  //recommend based on current page
  pub.recommendCurrent = function(){
    var alllinks = [];
    var pageDoc = gBrowser.selectedBrowser.contentDocument;
    var links = pageDoc.links;
    if(!links)
      return;
    var len = links.length;
    var alllinks = [];
    for(var i=0;i<len;i++){
      if(links[i]){
        alllinks.push(links[i]);
      }
    }
    pub.recommendInThread(pageDoc, alllinks);
  };
  
  pub.recommendInThread = function(pageDoc, alllinks){
    pub.main.dispatch(new pub.recommendThread(1, pageDoc, alllinks), pub.main.DISPATCH_NORMAL);
  };
  
  pub.recommendThread = function(threadID, pageDoc, alllinks) {
    this.threadID = threadID;
    this.pageDoc = pageDoc;
    this.alllinks = alllinks;
  };
  
  pub.recommendThread.prototype = {
    run: function() {
      try {
        pub.recommend(this.pageDoc, this.alllinks);
      } catch(err) {
        Components.utils.reportError(err);
      }
    },
  
    QueryInterface: function(iid) {
      if (iid.equals(Components.interfaces.nsIRunnable) ||
          iid.equals(Components.interfaces.nsISupports)) {
              return this;
      }
      throw Components.results.NS_ERROR_NO_INTERFACE;
    }
  };
  
  pub.recommend = function(pageDoc, allLinks){
    var currLoc = pageDoc.location.href;
    var title = pageDoc.title;
    pub.DEBUGINFO = "";
    pub.starttime = (new Date()).getTime();
    //TODO: put in topicTracker
    var allwords = pub.getTopic(title, " ", pub.stopwords, pub.specials);
    //without any history tracking
    //TODO: only pick the words related to interest, not every non-stopword
    //TODO: search for allwords in history, get the direct children, get all words from them, and choose the link that have those words.
    var pidsWithWord=[];
    //if new tab or no title at all, no recommendation
    if(allwords.length==0){
      return [];
    }/*else if(pub.DEBUG){
      alert(allwords);
    }*/
    pub.tmp = (new Date()).getTime();
    
    pidsWithWord = pub.history.searchIdbyKeywords([], allwords,[],[],[]);
    
    pub.sqltime.searchid = (new Date()).getTime()-pub.tmp;
    pub.tmp = (new Date()).getTime();
    
    var children = [];
    //get their children in history
    for(var i=0;i<pidsWithWord.length;i++){
      var c = pub.history.getAllChildrenfromPlaceId(pidsWithWord[i], null);
      children = children.concat(c);
    }
    pidsWithWord = pidsWithWord.concat(children);
    pidsWithWord = pub.utils.uniqueArray(pidsWithWord, false);
    
    pub.sqltime.getchild = (new Date()).getTime()-pub.tmp;
    
    var allRelated=[];
    pub.tmp = (new Date()).getTime();
    
    //remove dup titles for now
    var titles = [];
    for(var i=0;i<pidsWithWord.length;i++){
      var t = pub.history.getTitlefromId(pidsWithWord[i]);
      if(titles.indexOf(t)==-1){
        titles.push(t);
      }else{
        continue;
      }
      var relatedWords=pub.getTopic(t, " ", pub.stopwords, pub.specials);
      allRelated=allRelated.concat(relatedWords);
    }
    pub.sqltime.gettitle = (new Date()).getTime() -pub.tmp;
    pub.tmp = (new Date()).getTime();
    
    var relatedFromLocalNotes = pub.getLocal(allwords, pub.stopwords, pub.specials);
    allRelated=allRelated.concat(relatedFromLocalNotes);
    pub.sqltime.getlocal = (new Date()).getTime() -pub.tmp;
    pub.tmp = (new Date()).getTime();
    
    //store the small words for future segmentation
    //TODO: add size limit to dictionary, use it for all seg, including for future allRelated titles
    if(pub.DEBUG){
      pub.utils.sqltime.seg2 = 0;
      pub.utils.sqltime.seg4 = 0;
    }
    var segResults = pub.utils.segmentChn(allRelated);
    allRelated = segResults.all;
    var chnSmall = segResults.chnSmall;
    for(var s=0;s<chnSmall.length;s++){
      pub.utils.divInsert(chnSmall, pub.dictionary);
    }
    
    var origLen = allRelated.length;
    //sort the string array by string length, can speed up later processing
    //TODO: check if can save this as allRelated is sorted before in segment
    allRelated.sort(function(a,b){return a>b});
    var len = allRelated.length;
    var a = pub.utils.uniqueArray(allRelated, true);
    //get frequency of word (number of titles that contains it/number of all titles)
    /*a = pub.utils.removeHaveSubstring(a);*/
    var removed = len-a.arr.length;
    allRelated = a.arr;
    if(pub.DEBUG){
      var allover = 0;
      for(var i=0;i<a.arr.length;i++){
        if(!a.freq[a.arr[i]])
          alert("NO FREQ!: "+a.arr[i]);
        pub.DEBUGINFO+=a.arr[i]+ " " +a.freq[a.arr[i]]+"\n";
        allover+=a.freq[a.arr[i]];
      }
      pub.DEBUGINFO="sum of freq: "+allover+"\n"+pub.DEBUGINFO;
      pub.DEBUGINFO="searchid: "+ pub.sqltime.searchid + " getchild: "+pub.sqltime.getchild +
                  " gettitle: "+pub.sqltime.gettitle+
                  " segment: "+pub.utils.sqltime.seg0+" "+pub.utils.sqltime.seg1+
                  " "+pub.utils.sqltime.seg2+" "+pub.utils.sqltime.seg3+" "+pub.utils.sqltime.seg4 +"\n"+pub.DEBUGINFO;//+" segment: "+pub.sqltime.segment+"\n found new chn words: "+pub.debuginfo.newwords.length+"\n"+pub.debuginfo.newwords+
      pub.DEBUGINFO="local notes: "+relatedFromLocalNotes +"\nlocal time: "+pub.sqltime.getlocal+"\n"+pub.DEBUGINFO;
    }
    var freq = a.freq;
    //LATER: getNumofPidWithWord might be more precise, but much more time consuming.
    //       for now just use the wf in "relatedWords"
    /*var relFreq = [];
    var allPids = pub.history.getNumOfPid();
    for(var i=0;i<allRelated.length;i++){
      relFreq[allRelated[i]]=(pub.history.getNumofPidWithWord(allRelated[i])+0.0)/allPids;
    }*/
    //recLinks have object which format is: {link:xx,overallFreq:0.xx,kw:somewords}
    var recLinks = [];
    var recTitles = [];
    //alert("try on");
    var linkNumber = allLinks.length;
    for(var i=0;i<linkNumber;i++){
      var trimed = "";
      if(allLinks[i].text)
        trimed = pub.utils.trimString(allLinks[i].text);
      else
        continue;
      var t = trimed.toLowerCase();
      //remove the duplicate links (titles)
      if(recTitles.indexOf(t)>-1){
        continue;
      }else{
        recTitles.push(t);
      }
      var text=pub.getTopic(t, " ", pub.stopwords, pub.specials);
      //remove dup word in the title, for freq mult
      //TODO: less syntax, and maybe shouldn't remove dup, as more repetition may mean sth...
      text = pub.utils.uniqueArray(text, false);
      //if there's too few words (<3 for now), either catalog or tag, or very obvious already
      if(pub.tooSimple(text, pub.specials) && !/.*[\u4e00-\u9fa5]+.*$/.test(t)){
        continue;
      }
      //get the mul of keyword freq in all titles to be sorted
      var oF = 1;
      var keywords = [];
      //if there's chinese, go through every part, otherwise compare by word
      if(/.*[\u4e00-\u9fa5]+.*$/.test(t)){
        for(var j=0;j<allRelated.length;j++){
          if(t.indexOf(allRelated[j])>-1){
            if(text.length==1 && text[0]==allRelated[j])
              break;
            keywords.push(allRelated[j]);
            oF=oF*freq[allRelated[j]];
          }
        }
        //TODO: could be more than 2, but 2 is more likely, those with only those keywords are likely to be catagories
        /*if(keywords.length==2){
          if(t.length==keywords[0].length+keywords[1].length)
            continue;
        }*/
      }else{
        for(var j=0;j<allRelated.length;j++){
          if(text.indexOf(allRelated[j])>-1){
            //don't recommend those with only one word, like "msnbc.com"
            if(text.length==1 && text[0]==allRelated[j])
              break;
            keywords.push(allRelated[j]);
            oF=oF*freq[allRelated[j]];
          }
        }
      }
      if(oF<1){
        recLinks.push({link:allLinks[i],overallFreq:oF,kw:keywords});
      }
    }
    //sort by overallFreq
    recLinks.sort(function(a,b){return a.overallFreq-b.overallFreq});
    //don't pop up if there's no related links
    
    if(recLinks.length==0){
      if(pub.DEBUG)
        alert("just from current title:"+allwords);
      for(var i=0;i<allLinks.length;i++){
        var trimed = pub.utils.trimString(allLinks[i].text);
        var t = trimed.toLowerCase();
        //remove the duplicate links (titles)
        if(recTitles.indexOf(t)>-1){
          continue;
        }else{
          recTitles.push(t);
        }
        for(var w in allwords){
          if(t.indexOf(allwords[w])>-1){
            recLinks.push({link:allLinks[i],overallFreq:0,kw:allwords[w]});
          }
        }
      }
    }
    var recUri = [currLoc];
    //remove those that are visited already (maybe display differently?)
    //get rid of duplicate links
    for(var i=0;i<recLinks.length;i++){
      var uri = recLinks[i].link.href;
      if(recUri.indexOf(uri)>-1){
        //if(pub.DEBUG)
        //  alert(recLinks[i].link.text+"\n"+uri);
        recLinks.splice(i,1);
        i--;
      }else{
        recUri.push(uri);
      }
    }    
    if(recLinks.length>0){ 
      var o="";
      if(pub.DEBUG){
        o="removed "+removed+" from "+len+"\r\n";
      }
      //ONLY refresh current page when the panel is changed
      pub.currLoc = currLoc;
      pub.pageDoc = pageDoc;
      pub.popUp(title, o, recLinks, allLinks);
    }else if(pub.DEBUG){
        alert("alllinks:\n"+allLinks);
    }
    return recLinks;
  };

  /*-----------------UI below---------------------*/
  pub.setAttrDOMElement = function(ele, atts){
    for(var i in atts){
      ele.setAttribute(i, atts[i]);
    }
    return ele;
  };
  
  //return true if found a tab, false if not
  pub.switchToTab = function(doc){
    var wm = Components.classes["@mozilla.org/appshell/window-mediator;1"]
                     .getService(Components.interfaces.nsIWindowMediator);
    var browserEnumerator = wm.getEnumerator("navigator:browser");

    // Check each browser instance for our URL
    // TODO: as the panel is bound to one browser instance, it's not necessary to search all
    var found = false;
    while (!found && browserEnumerator.hasMoreElements()) {
      var browserWin = browserEnumerator.getNext();
      var tabbrowser = browserWin.gBrowser;
  
      // Check each tab of this browser instance
      var numTabs = tabbrowser.browsers.length;
      for (var index = 0; index < numTabs; index++) {
        var currentBrowser = tabbrowser.getBrowserAtIndex(index);
        if (doc == currentBrowser.contentDocument || pub.currLoc==currentBrowser.currentURI.spec) {
          // The URL is already opened. Select this tab.
          tabbrowser.selectedTab = tabbrowser.tabContainer.childNodes[index];
          // Focus *this* browser-window
          browserWin.focus();
          found = true;
          break;
        }
      }
    }
    
    // if the page was closed, open it first
    if (!found) {
      var browserEnumerator = wm.getEnumerator("navigator:browser");
      var tabbrowser = browserEnumerator.getNext().gBrowser;
      // Create tab
      var newTab = tabbrowser.addTab(pub.currLoc);
      // Focus tab
      tabbrowser.selectedTab = newTab;
      // Focus *this* browser window in case another one is currently focused
      tabbrowser.ownerDocument.defaultView.focus();
    }
    return found;
  };
  
  pub.testOpen = function(){
    //get the tab that's the suggestions derive from
    var currDoc = getBrowser().selectedBrowser.contentDocument;
    if(pub.pageDoc!= currDoc && pub.currLoc!=currDoc.location.href){
      //alert("need to switch tab");
      var found = pub.switchToTab(pub.pageDoc);
      if(!found){
        return;
      }
    }
    var link = this.getAttribute("fwtw-title");
    //TODO: this is to search for any line found first, can be inprecise
    var lines = link.split("\n");
    //get the first non-empty line of the link and search for it, but can mis-locate
    var found = false;
    for(var i in lines){
      found = getBrowser().selectedBrowser.contentWindow.find(lines[i], false, false);
      if(!found)
        found = getBrowser().selectedBrowser.contentWindow.find(lines[i], false, true);
      if(found)
        break;
    }
    //some links can not be found...invisble, then just open it
    if(!found){
      if(link!=pub.lastSearchTitle)
        gBrowser.addTab(this.getAttribute("href"));
    }else{
      pub.lastSearchTitle=link;
    }
  };
  
  pub.output = function(recLinks, allLinks){
    var outputText = "";
    var spendtime = 0;
    var ratio = 0;
    if(allLinks.length!=0){
      spendtime = (0.0+((new Date()).getTime()-pub.starttime))/1000;
      ratio = (0.0+Math.round((recLinks.length+0.0)*1000/allLinks.length))/10;
    }
    outputText += "Time: "+spendtime+"s      ";
    outputText += "Ratio(Num. of suggested/Num. of all links): "+ratio+"%\n";
    return outputText;
  };
  
  pub.popUp = function(origTitle, outputText, recLinks, allLinks){
    //const nm = "http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul";
    var version = pub.utils.getFFVersion();
    var savePanel = document.getElementById("fwtwRelPanel");
    var topbar, statsInfoLabel, vbox,debugtext,linkBox, testLink;
    if(pub.ANCHOR && recLinks.length>0){
    //for(var i=0;i<recLinks.length;i++){
      testLink = document.createElement("label");
      var anchURL = "#location";
      testLink = pub.setAttrDOMElement(testLink, {"value":recLinks[0].link.text.trim(),"onclick":"com.wuxuan.fromwheretowhere.recommendation.testOpen(\'"+anchURL+"\')"});//recLinks[i].link.href+"\')"});
      var anch = document.createElement("a");
      anch = pub.setAttrDOMElement(anch, {"name":"location"});
      //var currentDoc = document.commandDispatcher.focusedWindow.document;
      alert("try insert before: "+recLinks[0].link.text);
      alert(pub.pageDoc.links.length);
      recLinks[0].link.parentNode.insertBefore(anch, recLinks[0].link);
      alert("insert done");
    }
    //only reuse the panel for ff 4
    if(version>=4 && savePanel!=null){
      //alert("there's panel!");
      topbar = savePanel.firstChild;
      statsInfoLabel = topbar.firstChild.nextSibling;
      vbox = savePanel.firstChild.nextSibling;
    }else{
      //alert("creating new panel");
      var panelAttr = null;
      //close, label, titlebar only for ff 4
      if(version>=4)
        panelAttr = {"id":"fwtwRelPanel","titlebar":"normal","noautofocus":"true","noautohide":"true","close":"true","height":"200"};
      else{
        panelAttr = {"id":"fwtwRelPanel"};//"fade":"fast",
      }
      savePanel = document.createElement("panel");
      savePanel = pub.setAttrDOMElement(savePanel, panelAttr);
      //add the topbar
      topbar = document.createElement("hbox");
      //refresh button add on top
      var refreshButn = document.createElement("button");
      refreshButn.textContent="Refresh";
      refreshButn.onclick = pub.recommendCurrent;
      topbar.appendChild(refreshButn);
      //stats info
      statsInfoLabel = document.createElement("label");
      topbar.appendChild(statsInfoLabel);
      savePanel.appendChild(topbar);
      
      vbox = document.createElement("vbox");
      vbox = pub.setAttrDOMElement(vbox, {"flex":"1","style":"overflow:auto","width":"500","height":"100"});
      //alert("vbox created");
      //<textbox id="property" readonly="true" multiline="true" clickSelectsAll="true" rows="20" flex="1"/>
      //TODO: put links instead of pure text, and point to the links in page, may need to add bookmark in the page??

      savePanel.appendChild(vbox);
      if(version>=4){
        var resizer = document.createElement("resizer");
        resizer = pub.setAttrDOMElement(resizer, {"dir":"bottomright", "element":"fwtwRelPanel"});//, "right":"0", "bottom":"0", "width":"0", "height":"0"});
        savePanel.appendChild(resizer);
      }
      //this put the panel on the menu bar
      //menus.parentNode.appendChild(savePanel);
      //menus.parentNode.parentNode.appendChild(savePanel);
      document.documentElement.appendChild(savePanel);
    }
    if(pub.ANCHOR){
      savePanel.insertBefore(testLink, vbox);
      alert("testlink append");
    }
    statsInfoLabel.setAttribute("value", outputText+pub.output(recLinks,allLinks));//"It\r\nWorks!\r\n\r\nThanks for the point\r\nin the right direction.";
    while(vbox.hasChildNodes()){
      vbox.removeChild(vbox.firstChild);
    }
    
    var thisWindow = getBrowser().selectedBrowser.contentWindow;
          
    for(var i=0;i<recLinks.length;i++){
        var l = document.createElement("textbox");
        var t = recLinks[i].link.text;
        var uri = recLinks[i].link.href;
        var title = pub.utils.trimString(t);
        title = pub.utils.removeEmptyLine(title);
        var numLine = pub.utils.countChar("\n",title);
        var titleForSearch = title;
        if(pub.DEBUG)
          title+=" "+recLinks[i].kw+" "+ recLinks[i].overallFreq;
        
        /*if(numLine>0){
          l=pub.setAttrDOMElement(l, {"multiline":"true", "rows":new Number(numLine).toString()});
        }
        l = pub.setAttrDOMElement(l, {"class":"plain", "readonly":"true", "value":title});
        l.setAttribute("style", (i&1)?"background-color:#FFFFFF":"background-color:#EEEEEE");
        vbox.appendChild(l);*/

        var butn = document.createElement("button");
        //butn.setAttribute("style", "border: 0px; padding:0px;");//; text-align: center;");
        butn.setAttribute("class", "borderless");
        butn.onclick = pub.testOpen;
        butn.setAttribute("href", uri);
        butn.setAttribute("fwtw-title",titleForSearch);
        //butn.textContent=title;//"It\r\nWorks!\r\n\r\nThanks for the point\r\nin the right direction.";
        /*var predesc = document.createElement("description");
        predesc.textContent = "this is black ";
        predesc.setAttribute("style", "color:gray;");
        butn.appendChild(predesc);
        var middesc = document.createElement("description");
        middesc.textContent = "this is red ";
        middesc.setAttribute("style", "color:red;");
        butn.appendChild(middesc);*/
        var desc = document.createElement("description");
        desc.setAttribute("style", "white-space: pre-wrap");
        desc.setAttribute("flex", "1");
        desc.textContent=title;
        if(pub.history.getIdfromUrl(uri)!=null)
          desc.setAttribute("style", "color:gray;");
        butn.appendChild(desc);
        vbox.appendChild(butn);
      }
    if(pub.DEBUG){
      debugtext = document.createElement("textbox");
      debugtext = pub.setAttrDOMElement(debugtext, {"readonly":"true", "multiline":"true", "rows":"10", "cols":"70"})
      vbox.appendChild(debugtext);
      debugtext.setAttribute("value",pub.DEBUGINFO);
    }
    //document.parentNode.appendChild(savePanel); ->document.parentNode is null
    //document.appendChild(savePanel); -> node can't be inserted
    //pub.mainWindow.document.appendChild(savePanel);
    
    if(version<4){
      //can't anchor as in 4. WHY?
      savePanel.openPopup(null, "start_end", 60, 80, false, false);
    }else{
      savePanel.setAttribute("label","Seemingly Related or Interesting Link Titles"+" - "+origTitle);
      savePanel.openPopup(null, "start_end", 60, 80, false, false);//document.documentElement
    }
    //get all the links on current page, and their texts shown on page
    //can't get from overlay, still wondering
  };
  
  pub.init = function(){
    pub.utils = com.wuxuan.fromwheretowhere.utils;
    pub.main = Components.classes["@mozilla.org/thread-manager;1"].getService().mainThread;
    pub.mapOrigVerb = com.wuxuan.fromwheretowhere.corpus.mapOrigVerb();
    pub.stopwords = com.wuxuan.fromwheretowhere.corpus.stopwords_en_NLTK;
    pub.specials = com.wuxuan.fromwheretowhere.corpus.special;
    pub.history = com.wuxuan.fromwheretowhere.historyQuery;
    pub.history.init();
    pub.localmanager = com.wuxuan.fromwheretowhere.localmanager;
    pub.localmanager.init();
    
    pub.dictionary = [];
  };
    
  return pub;
}();