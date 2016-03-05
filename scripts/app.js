/**
 *
 * Copyright 2015 Google Inc. All rights reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
APP.Main = (function () {

    var LAZY_LOAD_THRESHOLD = 300;
    var $ = document.querySelector.bind(document);

    var stories = null;
    var storyStart = 0;
    var count = 100;
    var main = $('main');
    var inDetails = false;
    var storyLoadCount = 0;
    var localeData = {
        data: {
            intl: {
                locales: 'en-US'
            }
        }
    };

    var tmplStory = $('#tmpl-story').textContent;
    var tmplStoryDetails = $('#tmpl-story-details').textContent;
    var tmplStoryDetailsComment = $('#tmpl-story-details-comment').textContent;

    if (typeof HandlebarsIntl !== 'undefined') {
        HandlebarsIntl.registerWith(Handlebars);
    } else {

        // Remove references to formatRelative, because Intl isn't supported.
        var intlRelative = /, {{ formatRelative time }}/;
        tmplStory = tmplStory.replace(intlRelative, '');
        tmplStoryDetails = tmplStoryDetails.replace(intlRelative, '');
        tmplStoryDetailsComment = tmplStoryDetailsComment.replace(intlRelative, '');
    }

    var storyTemplate =
        Handlebars.compile(tmplStory);
    var storyDetailsTemplate =
        Handlebars.compile(tmplStoryDetails);
    var storyDetailsCommentTemplate =
        Handlebars.compile(tmplStoryDetailsComment);

    /**
     * As every single story arrives in shove its
     * content in at that exact moment. Feels like something
     * that should really be handled more delicately, and
     * probably in a requestAnimationFrame callback.
     */
    function onStoryData(key, details) {

        // This seems odd. Surely we could just select the story
        // directly rather than looping through all of them.
        //var storyElements = document.querySelectorAll('.story');
        var storyElement = document.querySelector('#s-' + key);

        details.time *= 1000;
        var story = storyElement;
        story.innerHTML = storyTemplate(details);
        story.addEventListener('click', onStoryClick.bind(this, details));
        story.classList.add('clickable');

        storyLoadCount--;

        // Colorize on complete.
        if (storyLoadCount === 0)
            requestAnimationFrame(function () {
                colorizeAndScaleStories(getUpdateStack());
            });
    }

    // Storage for comments
    var commentDataCache = {};

    // Prepare story details view
    var storyDetails = document.createElement('section'),
        commentsElement, storyHeader, storyContent;

    storyDetails.classList.add('story-details');
    document.body.appendChild(storyDetails);

    function onStoryClick(details) {
        // Wait a little time then show the story details.
        //setTimeout(showStory, 60);

        // Update template
        // Create and append the story. A visual change...
        // perhaps that should be in a requestAnimationFrame?
        // And maybe, since they're all the same, I don't
        // need to make a new element every single time? I mean,
        // it inflates the DOM and I can only see one at once.

        if (details.url)
            details.urlobj = new URL(details.url);

        var storyDetailsHtml = storyDetailsTemplate(details);
        var kids = details.kids;
        var commentHtml = storyDetailsCommentTemplate({
            by: '', text: 'Loading comment...'
        });

        storyDetails.innerHTML = storyDetailsHtml;

        // Init view
        commentsElement = storyDetails.querySelector('.js-comments');
        storyHeader = storyDetails.querySelector('.js-header');
        storyContent = storyDetails.querySelector('.js-content');
        storyDetails.querySelector('.js-close').addEventListener('click', hideStory);

        //var headerHeight = storyHeader.getBoundingClientRect().height;
        //storyContent.style.paddingTop = headerHeight + 'px';

        if (typeof kids === 'undefined')
            return;

        var comments = {};
        for (var k = 0, comment, kidsLeft = kids.length; k < kids.length; k++) {
            comment = document.createElement('aside');
            comment.setAttribute('id', 'sdc-' + kids[k]);
            comment.classList.add('story-details__comment');
            comment.innerHTML = commentHtml;
            commentsElement.appendChild(comment);


            if (commentDataCache[kids[k]]) comment.innerHTML = commentDataCache[kids[k]];
            else {
                comments[kids[k]] = comment;

                // Update the comment with the live data.
                (function (comment, kidId) {
                    APP.Data.getStoryComment(kids[k], function (commentDetails) {
                        commentDetails.time *= 1000;

                        // Save to cache
                        commentDataCache[kidId] = storyDetailsCommentTemplate(
                            commentDetails,
                            localeData);

                        // Update view once
                        if (--kidsLeft === 0)
                            for (var commentId in comments)
                                comments[commentId].innerHTML = commentDataCache[commentId];
                    });
                })(comment, kids[k]);
            }
        }

        requestAnimationFrame(function () {
            var headerHeight = storyHeader.getBoundingClientRect().height;
            storyContent.style.paddingTop = headerHeight + 'px';
            setTimeout(showStory, 60);
        });
    }

    function showStory() {
        if (inDetails)
            return;

        inDetails = true;

        var storyDetailsPosition = storyDetails.getBoundingClientRect();
        var left = 0, deltaLeft = storyDetailsPosition.left * 0.1;

        if (!storyDetails)
            return;

        document.body.classList.add('details-active');
        storyDetails.style.opacity = 1;

        function animate() {
            // Now figure out where it needs to go.
            left += deltaLeft;

            // Set up the next bit of the animation if there is more to do.
            if (Math.abs(left) <= storyDetailsPosition.left - 0.5)
                requestAnimationFrame(animate);
            else
                left = storyDetailsPosition.left;

            // And update the styles. Wait, is this a read-write cycle?
            // I hope I don't trigger a forced synchronous layout!
            storyDetails.style.transform = 'translateX(-' + left + 'px)';
        }

        // We want slick, right, so let's do a setTimeout
        // every few milliseconds. That's going to keep
        // it all tight. Or maybe we're doing visual changes
        // and they should be in a requestAnimationFrame
        requestAnimationFrame(animate);
    }

    function hideStory() {
        if (!inDetails)
            return;

        var storyDetailsPosition = storyDetails.getBoundingClientRect();
        var left = storyDetailsPosition.right, deltaLeft = storyDetailsPosition.right * 0.1;

        document.body.classList.remove('details-active');
        storyDetails.style.opacity = 0;

        function animate() {
            // Now figure out where it needs to go.
            left -= deltaLeft;

            // Set up the next bit of the animation if there is more to do.
            if (Math.abs(left) > 0.5) requestAnimationFrame(animate);
            else {
                left = 0;
                inDetails = false;
            }

            // And update the styles. Wait, is this a read-write cycle?
            // I hope I don't trigger a forced synchronous layout!
            storyDetails.style.transform = 'translateX(-' + left + 'px)';
        }

        // We want slick, right, so let's do a setTimeout
        // every few milliseconds. That's going to keep
        // it all tight. Or maybe we're doing visual changes
        // and they should be in a requestAnimationFrame
        requestAnimationFrame(animate);
    }

    function getUpdateStack() {
        var SCROLL_SHIFT = 100;
        var storyElements = document.querySelectorAll('.story');

        var height = main.offsetHeight,
            topOffset = main.scrollTop - SCROLL_SHIFT,
            bottom = height + main.scrollTop + SCROLL_SHIFT;

        var changeStack = [];

        // It does seem awfully broad to change all the
        // colors every time!
        for (var s = 0; s < storyElements.length; s++) {
            var story = storyElements[s], storyBottom = story.offsetTop + story.getBoundingClientRect().height;

            if (storyBottom < topOffset || story.offsetTop > bottom) {
                if (story.classList.contains('story__in-view'))
                    changeStack.push(_changeObjectClassRemove(story, 'story__in-view'));

                continue;
            }

            if (!story.classList.contains('story__in-view'))
                changeStack.push(_changeObjectClassAdd(story, 'story__in-view'));

            var score = story.querySelector('.story__score');
            var title = story.querySelector('.story__title');
            var scoreRect = score.getBoundingClientRect();

            // Base the scale on the y position of the score.
            var scoreLocation = scoreRect.top;
            var scale = Math.min(1, 1 - (0.05 * ((scoreLocation - 170) / height)));
            var opacity = Math.min(1, 1 - (0.5 * ((scoreLocation - 170) / height)));

            // Now figure out how wide it is and use that to saturate it.
            var saturation = (100 * ((scoreRect.width - 38) / 2)),
                scaleStr = 'scale(' + scale + ')';

            changeStack.push(_changeObjectStyle(score, {
                transform: scaleStr,
                backgroundColor: 'hsl(42, ' + saturation + '%, 50%)'
            }));

            changeStack.push(_changeObjectStyle(title, {
                opacity: opacity
            }));
        }

        return changeStack;
    }

    /**
     * Does this really add anything? Can we do this kind
     * of work in a cheaper way?
     */
    function colorizeAndScaleStories(changeStack) {
        // Go through accumulated changes
        var elem, styles, classList;
        for (var i in changeStack) {
            elem = changeStack[i].elem;
            styles = changeStack[i].style;
            classList = changeStack[i].classList;

            // Apply class changes
            if (classList) elem.classList[classList.method](classList.name);

            // Apply style changes
            if (styles) for (var style in styles) elem.style[style] = styles[style];
        }
    }

    var header = $('header');
    var headerTitles = header.querySelector('.header__title-wrapper');
    var bodyClassList = document.body.classList;
    var UPDATE_THRESHOLD = header.getBoundingClientRect().height;

    main.addEventListener('scroll', function () {
        var scrollTop = main.scrollTop,
            scrollHeight = main.scrollHeight,
            offsetHeight = main.offsetHeight;
        var scrollTopCapped = Math.min(70, scrollTop);
        var scaleString = 'scale(' + (1 - (scrollTopCapped / 300)) + ')';

        if (scrollTop > UPDATE_THRESHOLD) var updateStack = getUpdateStack();

        // Add a shadow to the header.
        if (scrollTop > 70) bodyClassList.add('raised');
        else bodyClassList.remove('raised');

        // Check if we need to load the next batch of stories.
        var loadThreshold = (scrollHeight - offsetHeight - LAZY_LOAD_THRESHOLD);

        requestAnimationFrame(function () {
            if (scrollTop > loadThreshold)
                loadStoryBatch();

            header.style.transform = 'translateY(-' + scrollTopCapped + 'px)';
            headerTitles.style.webkitTransform = scaleString;
            headerTitles.style.transform = scaleString;
            if (scrollTop > UPDATE_THRESHOLD) colorizeAndScaleStories(updateStack);
        });
    });

    function loadStoryBatch() {

        if (storyLoadCount > 0)
            return;

        storyLoadCount = count;

        var lastStory = document.querySelector('.story__last');
        lastStory && lastStory.classList.remove('story__last');

        var end = storyStart + count;
        for (var i = storyStart; i < end; i++) {

            if (i >= stories.length)
                return;

            var key = String(stories[i]);
            var story = document.createElement('div');
            story.setAttribute('id', 's-' + key);
            story.classList.add('story');
            if (i === end - 1) story.classList.add('story__last');
            story.innerHTML = storyTemplate({
                title: '...',
                score: '-',
                by: '...',
                time: 0
            });
            main.appendChild(story);

            APP.Data.getStoryById(stories[i], onStoryData.bind(this, key));
        }

        storyStart += count;
    }

    function _changeObjectClassAdd(elem, className) {
        return _changeObjectClass(elem, 'add', className);
    }

    function _changeObjectClassRemove(elem, className) {
        return _changeObjectClass(elem, 'remove', className);
    }

    function _changeObjectClass(elem, mode, className) {
        return _changeObject(elem, 'classList', {
            method: mode,
            name: className
        });
    }

    function _changeObjectStyle(elem, style) {
        return _changeObject(elem, 'style', style);
    }

    function _changeObject(elem, name, value) {
        var obj = {
            elem: elem
        };
        obj[name] = value;
        return obj;
    }

    // Bootstrap in the stories.
    APP.Data.getTopStories(function (data) {
        stories = data;
        loadStoryBatch();
        main.classList.remove('loading');
    });

})();
