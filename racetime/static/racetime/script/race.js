function Race() {
    this.socketListeners = {
        close: this.onSocketClose.bind(this),
        error: this.onSocketError.bind(this),
        message: this.onSocketMessage.bind(this),
        open: this.onSocketOpen.bind(this)
    };
    this.messageIDs = [];

    try {
        this.vars = JSON.parse($('#race-vars').text());
        for (var i in this.vars.chat_history) {
            if (!this.vars.chat_history.hasOwnProperty(i)) continue;
            this.addMessage(this.vars.chat_history[i]);
        }
        this.open();
    } catch (e) {
        if ('notice_exception' in window) {
            window.notice_exception(e);
        } else {
            throw e;
        }
    }
}

Race.prototype.ajaxifyActionForm = function(form) {
    var self = this;
    $(form).ajaxForm({
        clearForm: true,
        beforeSubmit: function() {
            $('.race-action-form button').prop('disabled', true);
        },
        beforeSerialize: function($form) {
            if ($form.hasClass('add_comment')) {
                var comment = prompt('Enter a comment:');
                if (!comment) return false;
                var $input = $('<input type="hidden" name="comment">');
                $input.val(comment);
                $input.appendTo($form);
            }
        },
        error: self.onError.bind(self)
    });
};

Race.prototype.addMessage = function(message) {
    var self = this;

    if (self.messageIDs.indexOf(message.id) !== -1) {
        return true;
    }

    if (!message.is_system || message.message !== '.reload') {
        var $messages = $('.race-chat .messages');
        $messages.append(self.createMessageItem(message));
        $messages[0].scrollTop = $messages[0].scrollHeight
    }

    self.messageIDs.push(message.id);
};

Race.prototype.createMessageItem = function(message) {
    var date = new Date(message.posted_at);
    var timestamp = ('00' + date.getHours()).slice(-2) + ':' + ('00' + date.getMinutes()).slice(-2);

    var $li = $(
        '<li>'
        + '<span class="timestamp">' + timestamp + '</span>'
        + '<span class="message"></span>'
        + '</li>'
    );

    if (message.is_system) {
        $li.addClass('system');
    } else {
        var $user = $('<span class="user"></span>');
        $user.text(message.user.name);
        $user.insertAfter($li.children('.timestamp'));
    }
    if (message.highlight) {
        $li.addClass('highlight')
    }
    var $message = $li.children('.message');
    $message.text(message.message);
    if (message.is_system) {
        $message.html($message.html().replace(/##(\w+?)##(.+?)##/g, function(matches, $1, $2) {
            return '<span class="' + $1 + '">' + $2 + '</span>';
        }));
    }
    $message.html($message.html().replace(/(https?:\/\/[^\s]+)/g, function(matches, $1) {
        return '<a href="' + $1 + '" target="_blank">' + $1 + '</a>';
    }));

    return $li;
};

Race.prototype.onError = function(xhr) {
    var self = this;
    if (xhr.status === 422) {
        if (xhr.responseText.indexOf('<ul class="errorlist">') !== -1) {
            var $errors = $(xhr.responseText);
            $errors.children('li').each(function() {
                var field = $(this).text();
                $errors.children('li').each(function() {
                    self.whoops(field + ': ' + $(this).text());
                });
            });
        } else {
            self.whoops(xhr.responseText);
        }
        $('.race-action-form button').prop('disabled', false);
    } else {
        self.whoops(
            'Something went wrong (code ' + xhr.status + '). ' +
            'Reload the page to continue.'
        );
    }
};

Race.prototype.onSocketClose = function(event) {
    $('.race-chat').addClass('disconnected');

    if (event.code !== 1000) {
        this.reconnect();
    }
};

Race.prototype.onSocketError = function(event) {
    $('.race-chat').addClass('disconnected');
    this.reconnect();
};

Race.prototype.onSocketMessage = function(event) {
    try {
        var data = JSON.parse(event.data);
    } catch (e) {
        if ('notice_exception' in window) {
            window.notice_exception(e);
            return;
        } else {
            throw e;
        }
    }

    switch (data.type) {
        case 'race.data':
            this.raceTick();
            break;
        case 'chat.message':
            this.addMessage(data.message);
            break;
    }
};

Race.prototype.onSocketOpen = function(event) {
    $('.race-chat').removeClass('disconnected');
};

Race.prototype.open = function() {
    var proto = location.protocol === 'https:' ? 'wss://' : 'ws://';
    this.chatSocket = new WebSocket(proto + location.host + this.vars.urls.chat);
    for (var type in this.socketListeners) {
        this.chatSocket.addEventListener(type, this.socketListeners[type]);
    }
};

Race.prototype.raceTick = function() {
    var self = this;
    $.get(self.vars.urls.renders, function(data, status, xhr) {
        var latency = 0;
        if (xhr.getResponseHeader('X-Date-Exact')) {
            latency = new Date(xhr.getResponseHeader('X-Date-Exact')) - new Date();
        }
        requestAnimationFrame(function() {
            for (var segment in data) {
                if (!data.hasOwnProperty(segment)) continue;
                var $segment = $('.race-' + segment);
                $segment.html(data[segment]);
                $segment.find('time').data('latency', latency);
                window.localiseDates.call($segment[0]);
                $segment.find('.race-action-form').each(function() {
                    self.ajaxifyActionForm(this);
                });
            }
            // This is kind of a fudge but replacing urlize is awful.
            $('.race-info .info a').each(function() {
                $(this).attr('target', '_blank');
            });
        });
    });
};

Race.prototype.reconnect = function() {
    for (var type in this.socketListeners) {
        this.chatSocket.removeEventListener(type, this.socketListeners[type]);
    }

    setTimeout(function() {
        this.open();
    }.bind(this), 1000);
};

Race.prototype.whoops = function(message) {
    var $messages = $('.race-chat .messages');
    var date = new Date();
    var timestamp = ('00' + date.getHours()).slice(-2) + ':' + ('00' + date.getMinutes()).slice(-2);
    var $li = $(
        '<li class="error">' +
        '<span class="timestamp">' + timestamp + '</span>' +
        '<span class="message"></span>' +
        '</li>'
    );
    $li.find('.message').text(message);
    $messages.append($li);
    $messages[0].scrollTop = $messages[0].scrollHeight
};

$(function() {
    var race = new Race();
    window.race = race;

    $('.race-action-form').each(function() {
        race.ajaxifyActionForm(this);
    });

    $('.race-chat form').ajaxForm({
        error: race.onError.bind(race),
        success: function() {
            $('.race-chat form textarea').val('').height(18);
        }
    });

    $(document).on('keydown', '.race-chat form textarea', function(event) {
        if (event.which === 13) {
            if ($(this).val()) {
                $(this).closest('form').submit();
            }
            return false;
        }
    });

    $(document).on('change input keyup', '.race-chat form textarea', function() {
        $(this).height($(this)[0].scrollHeight - 10);
    });

    $(document).on('click', '.dangerous .btn', function() {
        return confirm($(this).text().trim() + ': are you sure you want to do that?');
    });
});
