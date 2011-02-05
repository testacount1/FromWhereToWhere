com.wuxuan.fromwheretowhere.recommendation = function(){
  var pub={};
    
  pub.mainWindow = window.QueryInterface(Components.interfaces.nsIInterfaceRequestor)
        .getInterface(Components.interfaces.nsIWebNavigation)
        .QueryInterface(Components.interfaces.nsIDocShellTreeItem)
        .rootTreeItem
        .QueryInterface(Components.interfaces.nsIInterfaceRequestor)
        .getInterface(Components.interfaces.nsIDOMWindow);
 
  pub.DEBUG = true;
  pub.TOOFEWWORDS = 4
  pub.MULTILINE_LIMIT = 3;
  pub.starttime = 0;
  
  //also remove all numbers, as they don't seem to carry much "theme" info
  pub.filter = function(allwords, stopwords, specials){
    for(var i=0; i<allwords.length; i++){
      allwords[i] = allwords[i].toLowerCase();
      //stupid way to get rid of special char from the utterance
      //those with , and : -- useful semantic, but for now clean up
      for(var j=0;j<specials.length;j++){
        allwords[i]=allwords[i].replace(new RegExp(specials[j],"g"),"");
      }
      if(stopwords.indexOf(allwords[i])>-1 || specials.indexOf(allwords[i])>-1 || allwords[i]=="" || allwords[i]==" " || allwords[i].match(/[0-9]/)!=null){
        allwords.splice(i, 1);
        i--;
      }
    }
    return allwords;
  };
  
  pub.getTopic = function(title, stopwords, specials){
    if(title==null){
      return [];
    }
    var allwords = title.split(" ");
    return pub.filter(allwords, stopwords, specials);
  };
  
  pub.tooSimple = function(allwords){
    var rmSpecials = pub.filter(allwords, [], com.wuxuan.fromwheretowhere.corpus.special);
    if(rmSpecials.length<pub.TOOFEWWORDS){
      return true;
    }else{
      return false;
    }
  };
  
  pub.recommend = function(title, allLinks){
    pub.starttime = (new Date()).getTime();
    var stopwords = com.wuxuan.fromwheretowhere.corpus.stopwords_en_NLTK;
    var specials = com.wuxuan.fromwheretowhere.corpus.special;
    //TODO: put in topicTracker
    var allwords = pub.getTopic(title, stopwords, specials);
    //without any history tracking
    //TODO: only pick the words related to interest, not every non-stopword
    //TODO: search for allwords in history, get the direct children, get all words from them, and choose the link that have those words.
    var pidsWithWord=[];
    //if new tab or no title at all, no recommendation
    if(allwords.length==0){
      return [];
    }
    for(var i=0;i<allwords.length;i++){
      var pids = pub.history.searchIdbyKeywords([allwords[i]], [], [], []);
      //if too many pids with one single word, may mean sth...
      pidsWithWord = pidsWithWord.concat(pids);
    }
    pidsWithWord = pub.utils.uniqueArray(pidsWithWord, false);
    var children = [];
    //get their children in history
    for(var i=0;i<pidsWithWord.length;i++){
      var c = pub.history.getAllChildrenfromPlaceId(pidsWithWord[i], null);
      children = children.concat(c);
    }
    pidsWithWord = pidsWithWord.concat(children);
    pidsWithWord = pub.utils.uniqueArray(pidsWithWord, false);
    //stupid, somehow there's some code piece of unique in the array??!!WTF??
    for(var i=0;i<pidsWithWord.length;i++){
      if(!(pidsWithWord[i]>0)){
        pidsWithWord.splice(i,1);
        i--;
      }
    }
    var allRelated=[];
    for(var i=0;i<pidsWithWord.length;i++){
      var t = pub.history.getTitlefromId(pidsWithWord[i]);
      var relatedWords=pub.getTopic(t, stopwords, specials);
      allRelated=allRelated.concat(relatedWords);
    }
    var origLen = allRelated.length;
    var a = pub.utils.uniqueArray(allRelated, true);
    //get frequency of word (number of titles that contains it/number of all titles)
    allRelated = a.arr;
    var freq = a.freq;
    //LATER: getNumofPidWithWord might be more precise, but much more time consuming.
    //       for now just use the wf in "relatedWords"
    /*var relFreq = [];
    var allPids = pub.history.getNumOfPid();
    for(var i=0;i<allRelated.length;i++){
      relFreq[allRelated[i]]=(pub.history.getNumofPidWithWord(allRelated[i])+0.0)/allPids;
    }*/
    //first get all "context" word, can be anormous...let's see
    var recLinks = [];
    var recTitles = [];
    for(var i=0;i<allLinks.length;i++){
      var trimed = pub.utils.trimString(allLinks[i].text);
      var t = trimed.toLowerCase();
      //remove the duplicate links (titles)
      if(recTitles.indexOf(t)>-1){
        continue;
      }else{
        recTitles.push(t);
      }
      var text = t.split(" ");
      //remove dup word in the title, for freq mult
      text = pub.utils.uniqueArray(text, false);
      //if there's too few words (<3 for now), either catalog or tag, or very obvious already
      if(pub.tooSimple(text)){
        continue;
      }
      //get the mul of keyword freq in all titles to be sorted
      var oF = 1;
      var keywords = [];
      for(var j=0;j<allRelated.length;j++){
        if(text.indexOf(allRelated[j])>-1){
          //don't recommend those with only one word, like "msnbc.com"
          if(text.length==1 && text[0]==allRelated[j])
            break;
          keywords.push(allRelated[j]);
          oF=oF*freq[allRelated[j]];
        }
      }
      if(oF<1){
        recLinks.push({link:allLinks[i],overallFreq:oF,kw:keywords});
      }
    }
    //sort by overallFreq
    recLinks.sort(function(a,b){return a.overallFreq-b.overallFreq});
    //don't pop up if there's no related links
    if(recLinks.length>0)
      pub.popUp(recLinks,allLinks);
    return recLinks;
  };

  pub.setAttrDOMElement = function(ele, atts){
    for(var i in atts){
      ele.setAttribute(i, atts[i]);
    }
    return ele;
  };

  pub.testOpen = function(link){
    alert("opend "+link);
    //window.open(link);
    gBrowser.addTab(link);
  };
  
  pub.testFocus = function(idx){
    alert(idx);
    var amount = 4;
    //var range = document.createRange();
    var el = pub.rec[idx];
    /*var oRange = d.createTextRange();
    oRange.moveStart("character", 0);
    oRange.moveEnd("character", amount - d.value.length);
    oRange.select();
    d.focus();
    alert(focus);
    range.setStart(focus, 0);
    range.setEnd(focus, amount);*/
    //range.selectNode(focus);
    var body = document.body, range, sel;
    if (body && body.createTextRange) {
        range = body.createTextRange();
        range.moveToElementText(el);
        range.select();
    } else if (document.createRange && window.getSelection) {
        range = document.createRange();
        range.selectNodeContents(el);
        sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(range);
    }
    //el.focus();  --> is not a function
  };
  
  pub.rec = [];
  
  pub.popUp = function(recLinks, allLinks){
    var outputLinks = "";
    outputLinks += "time: "+(0.0+((new Date()).getTime()-pub.starttime))/1000+"s\n";
    if(pub.DEBUG)
      outputLinks += "ratio: "+(recLinks.length+0.0)/allLinks.length+"\n";
    for(var i=0;i<recLinks.length;i++){
      var title = pub.utils.trimString(recLinks[i].link.text)
      //remove those titles > 3 lines, can be functions...
      if(title.split("\n").length<=pub.MULTILINE_LIMIT){
        outputLinks+=title;
        if(pub.DEBUG)
          outputLinks+=" "+recLinks[i].kw+" "+ recLinks[i].overallFreq;
        outputLinks+="\n";
      }else{
        //alert("multiline>3:\n"+title);
      }
    }
    //pub.rec = recLinks;
    /*if(recLinks.length>0){
    //for(var i=0;i<recLinks.length;i++){
      //var testLink = pub.createElement(document, "label", {"value":recLinks[i].link.text.trim(),"onclick":"com.wuxuan.fromwheretowhere.recommendation.testOpen(\'"+recLinks[i].link.href+"\')"});
      var testLink = pub.createElement(document, "label", {"value":recLinks[0].link.text.trim(),"onclick":"com.wuxuan.fromwheretowhere.recommendation.testFocus("+0+")"});
      savePanel.appendChild(testLink);
    }*/
    //const nm = "http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul";
    var version = pub.utils.getFFVersion();
    var savePanel = document.getElementById("fwtwRelPanel");
    var vbox,desc;
    //only reuse the panel for ff 4
    if(version>=4 && savePanel!=null){
      //alert("there's panel!");
      vbox = savePanel.firstChild;
      desc = vbox.firstChild;
    }else{
      //alert("creating new panel");
      var panelAttr = null;
      //close, label, titlebar only for ff 4
      if(version>=4)
        panelAttr = {"id":"fwtwRelPanel","label":"Seemingly Related or Interesting Link Titles","titlebar":"normal","noautohide":"true","close":"true"};
      else{
        //alert("create panel for ff3");
        panelAttr = {"id":"fwtwRelPanel"};//"fade":"fast",
      }
      savePanel = document.createElement("panel");
      savePanel = pub.setAttrDOMElement(savePanel, panelAttr);
      vbox = document.createElement("vbox");
      //<textbox id="property" readonly="true" multiline="true" clickSelectsAll="true" rows="20" flex="1"/>
      //TODO: put links instead of pure text, and point to the links in page, may need to add bookmark in the page??
      desc = document.createElement("textbox");
      desc = pub.setAttrDOMElement(desc, {"readonly":"true", "multiline":"true", "rows":"8", "cols":"70"})  
      vbox.appendChild(desc);
      savePanel.appendChild(vbox);
      //this put the panel on the menu bar
      //menus.parentNode.appendChild(savePanel);
      //menus.parentNode.parentNode.appendChild(savePanel);
      document.documentElement.appendChild(savePanel);
    }
    desc.setAttribute("value",outputLinks);
    //document.parentNode.appendChild(savePanel); ->document.parentNode is null
    //document.appendChild(savePanel); -> node can't be inserted
    //pub.mainWindow.document.appendChild(savePanel);
    
    if(version<4){
      //can't anchor as in 4. WHY?
      savePanel.openPopup(null, "start_end", 60, 80, false, false);
    }else{
      savePanel.openPopup(document.documentElement, "start_end", 60, 80, false, false);
    }
    //get all the links on current page, and their texts shown on page
    //can't get from overlay, still wondering
  };
  
  pub.init = function(){
    pub.utils = com.wuxuan.fromwheretowhere.utils;
    pub.history = com.wuxuan.fromwheretowhere.historyQuery;
  };
    
  return pub;
}();