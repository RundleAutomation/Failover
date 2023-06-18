console.log('in test_failover.js');

$(document).ready(() => {
    updateStatus();
});
function goPrime() {
    updateStatus();
}
function goBackup() {
    updateStatus();
}
function reporting(pages) {
    let text = '';
    for(var pageID in pages) {
        let page = pages[pageID];
        text += `ID: ${page.pageID},  description: ${page.description}, status: ${page.status}<br>`;
    }
    $('#report-result').html(text);
}
function commandResult(command, result) {
    switch(command) {
        case 'register': $('#register-result').html(result); updatePage(); break;
        case 'unregister': $('#unregister-result').html(result); updatePage(); break;
        case 'go prime': $('goprime-result').html(result); break;
        case 'go backup': $('gobackup-result').html(result); break;
    }
    updateStatus();
}
$('#register').on('click', function(ev) {
    let description = getPageDescription();
    Failover.register(description, goPrime, goBackup, reporting, commandResult);
});

$('#unregister').on('click', function(ev) {
    Failover.unregister();
    updatePage();
    updateStatus();
})

$('#goprime').on('click', function(ev) {
    Failover.setPrime();
})

$('#gobackup').on('click', function(ev) {
    Failover.setBackup();
})

$('#rogueprime').on('click', function(ev) {
    Failover.page.setStatus("i am prime");
    updateStatus();
})

$('#report').on('click', function(ev) {
    Failover.getReporting();
});

function getPageDescription() {
    let description = $('#page-description').val();
    return description;
}

function updateStatus() {
    $('#page-status').removeClass('bg-success bg-warning bg-secondary text-white text-black')
    let page = Failover.page;
    if(page) {
        let status = page.getStatus();
        if(status == 'i am prime') {
            $('#page-status').html('I am Prime').addClass('bg-success text-white')
        } else if(status == 'i am backup') {
            $('#page-status').html('I am Backup').addClass('bg-warning text-black');
        }
    } else {
        $('#page-status').html('Unregistered').addClass('bg-secondary text-white')
    }

}
function updatePage() {
    let page = Failover.page;
    if(page) {
        $('#page-description').val(page.getDescription());
        $('#page-id').val(page.getID());
    } else {
        $('#page-description').val('');
        $('#page-id').val('');
    }
}
