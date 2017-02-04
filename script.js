  $(document).ready(function() {
    var token = username = token = dataStore = null,
        conversation
    ;
    //set front listener for current conversation
    Front.on('conversation', function (data) {
      conversation = data;
    });

    // when user click sign in set username/token
    $('#signin').submit(function(event) {
      var url = 'https://api.github.com/user';
      event.preventDefault();
      username = setUsername(event.target.username.value);
      token = setToken(event.target.token.value);
      apiCall(url, 'get', null, 'getSignIn');
    });

    // when user click repository post form check to make sure a repo is chosen then post to github API
    $( "#repoform" ).submit(function(event) {
      event.preventDefault();
      var repoId = $( "#repocontainer option:selected");
      if (repoId[0].value === "Choose a Repo") {
        frontThrowAlert('Hold Up!','Please select a repo.','Close');
        return;
      };
      var assigneeid = $("#assigneeContainer option:selected")[0].value || '',
          issueName = event.target.issuename.value || '',
          issueDescription =  event.target.description.value || '',
          idForRef = repoId[0].value || '',
          ownerName = dataStore.repos[idForRef].owner.login || '',
          repoName = dataStore.repos[idForRef].name || '',
          url = ['https://api.github.com/repos/', ownerName, '/', repoName, '/issues'].join('') || '',
          assigneeName = dataStore.assignee[assigneeid].login || '',
          data = JSON.stringify({"title": issueName, "body": issueDescription, "assignees":[assigneeName]}) || ''
      ;
      apiCall(url, 'POST', data, 'postIssues');
    });

    // if user click on the add conversation checkbox populate the title/body.
    // when they uncheck clear the form.
    $('#convoGrab').click(function() {
        if(this.checked && !!conversation) {
          // trim string to a resonable length for this iteration
          var length = 500,
              trimmedString = conversation.message.text.substring(0, length)
          ;
          $('#repoformtitle').val(conversation.message.subject);
          $('#repoformdescrip').val(trimmedString);
        } else {
          $('#repoformdescrip').val('');
          $('#repoformtitle').val('');
        }
    });

    //when the user selects a repo gather its assignees and issues
    $("#repocontainer").change(function() {
      var repoId = $( "#repocontainer option:selected"),
          id = repoId[0].value,
          idForRef = repoId[0].value,
          ownerName = dataStore.repos[idForRef].owner.login,
          repoName = dataStore.repos[idForRef].name,
          url = ['https://api.github.com/repos/', ownerName, '/', repoName, '/'].join('')
      ;
      apiCall(url + 'issues', 'get', {"state": 'all'}, 'getIssues');
      apiCall(url + 'assignees', 'get', null, 'getAssignee');
    });

    // change the menu when the user selects either
    $("#issuesTab > ul > li").click(function() {
      if (!$(this).hasClass("is-active")) {
        $(this).addClass('is-active');
        $(this).siblings().removeClass('is-active');
        if(this.dataset.tabType === "viewRepo") {
          showElement("#viewRepo");
          hideElement("#postRepo");
        } else {
          showElement("#postRepo");
          hideElement("#viewRepo");
        };
      };
    });

    // when a user clicks a issue on the view tab open a window with the url to that link on github
    $("#issuesList").on('click','.panel-block', function() {
      if (this.dataset.link){
        window.open(this.dataset.link, "_blank", "toolbar=yes,scrollbars=yes,resizable=yes,top=500,left=500,width=400,height=400");
      };
    });

  //set datastore as user pulls more info
    function setDataStore(type, data) {
        var placeholder = {};
        //if no info set the null datastore varibale to an empty object
        if (!dataStore) {
          dataStore = {};
          dataStore[type] = data;
        } else {
          for (var i = 0; i < data.length; i++) {
              placeholder[data[i].id] = data[i];
          };
          dataStore[type] = placeholder;
        };
        return dataStore;
    }

    function getDataStore() {
      return dataStore;
    }

    function setToken(token) {
        token = token;
        return token;
    };

    function setUsername(username) {
        username = username;
        return username;
    };

    function apiCall(url, method, data, type) {
      showElement('#loadercard');
      $.ajax({
          url: url,
          headers: {
              'Authorization': "Basic " + btoa(username + ":" + token)
          },
          dataType: "json",
          method: method,
          data: data,
          success: function(data) {
            hideElement('#loadercard');
            successResponse(type, data);
          },
          error: function(data) {
            hideElement('#loadercard');
            type === 'getSignIn' ? showElement('#signincard') : showElement('#repocard');
            frontThrowAlert(
              [data.status, ' : ', data.responseJSON.message].join(''),
              'Please try again later',
              'Close'
              );
          }
      });
    };

    function frontThrowAlert(title, message, okTitle) {
      Front.alert({
          title: title,
          message: message,
          okTitle: okTitle
      }, function () {
          console.log('User clicked OK.');
      });
    }

    // for each resposne repond by updating the DOM based on api call type.
    function successResponse(type, resData) {
      var data, url;
      switch(type) {
        case "getSignIn":
          hideElement("#signincard");
          data = {'per_page': 100, type: 'all', sort: 'created'};
          url = 'https://api.github.com/user/repos';
          setDataStore('user', resData);
          apiCall(url, 'get', data, 'getRepo');
          break;
        case "getRepo":
          setDataStore('repos', resData);
          createElements('#repocontainer', 'option', 'repos', getDataStore());
          showElement("#repocard");
          break;
        case 'getAssignee':
          setDataStore('assignee', resData);
          emptyElement('#assigneeContainer');
          createElements('#assigneeContainer', 'option', 'assignee', getDataStore());
          break;
        case "getIssues":
          setDataStore('issues', resData);
          emptyElement('#issuesList');
          createIssuesList('#issuesList', 'issues', getDataStore());
          break;
        case "postIssues":
          frontThrowAlert('Awesome!','Your issue has been sent.','Close');
          frontSendMessage(resData);
          resetForm('#repoform');
          break;
        default:
          console.log('null');
      }
    };

    function hideElement(elementId) {
      $(elementId).hide();
    };

    function showElement(elementId) {
      $(elementId).show();
    };

    function emptyElement(elementId){
      $(elementId).empty();
    };

    // create multiple elements by setting the parent and setting content to either login or name depennding on the use case.
    function createElements(elementId, elementType, type, data) {
      for (var prop in data[type]) {
        var content = !data[type][prop].name ? data[type][prop].login : data[type][prop].name;
        $(elementId)
          .append(
            ["<", elementType, " name='", type, "' value='", data[type][prop].id, "'>", content ,"</", elementType, " >"
            ].join(''));
      };
    };

    // when the user checks the compose reply checkbox
    //will set up a front message to send
    //adds a repo link to the email
    function frontSendMessage(resData) {
      var subject = ['Github Alert for issue: #', resData.number, ' (', resData.title, ')'].join('') || '',
          linkMesage = ['\n link: ', resData.html_url].join('') || '',
          bodyMessage = resData.body || ''
      ;
      if($("#replyToConvo").is(':checked')) {
        Front.compose({
            subject: subject,
            body:  bodyMessage + linkMesage
        });
      };
    }

    function resetForm(formId) {
      $(formId)[0].reset();
    };

    function createIssuesList(elementId, type, data) {
        var iconClass;
        emptyElement('#issuesList');
        for (var prop in data[type]) {
          if (data[type][prop].state === "open") {
            iconClass = "fa fa-file-code-o";
          } else {
            iconClass = "fa fa-times-circle";
          };
          $(elementId)
            .append(
              [
                "<a class='panel-block'",
                "data-link='", data[type][prop].html_url ,"' '>",
                "<span class='panel-icon'>",
                "<i class='", iconClass,"'></i>",
                "</span>",
                data[type][prop].title,
                "</a>"
              ]
              .join('')
            );
        };
    }
});
