var url = '/failover.js?v=1.20230618';
var pageID = crypto.randomUUID();

var onconnect = function(ev) {
    const port = ev.ports[0];
    port.addEventListener("message", function(e) {
        let command = e.data[0];
        let pageID = e.data[1];
        let args = e.data[2];
        let result = Failover.handleCommand(command, pageID, args);
        port.postMessage([command, result]);
    });
    port.start();
}

var Failover = (function() {
    var self = this;
    class pageContext {
        pageID;
        description;
        status;
        checkStamp;
        statusStamp;
        constructor(description, pageID = null) {
            if(!pageID) {
                this.pageID = crypto.randomUUID();
            } else {
                this.pageID = pageID;
            }
            this.description = description;
            this.status = iAmBackupMessage;
            this.checkStamp = Date.now();
            this.statusStamp = Date.now();
        }
        setStatus(status) {
            this.status = status;
            this.statusStamp = Date.now();
        }
        setCheckStamp() {
            this.checkStamp = Date.now();
        }
        isExpired(timeout) {
            if(this.statusStamp >= this.checkStamp)
                return false;
            else if(Date.now() - this.checkStamp < timeout * 1000)
                return false;
            else
                return true;
        }
        isPrime() {
            return this.status == iAmPrimeMessage;
        }
        isBackup() {
            return this.status == iAmBackupMessage;
        }
        getStatus() {
            return this.status;
        }
        getID() {
            return this.pageID;
        }
        getDescription() {
            return this.description;
        }
    }
    const helloMessage = 'hello';
    const iAmBackupMessage = 'i am backup';
    const iAmPrimeMessage = 'i am prime';
    const goPrimeMessage = 'go prime';
    const goBackupMessage = 'go backup';
    const registerCommand = 'register';
    const unregisterCommand = 'unregister';
    const reportingCommand = 'report';
    this.pages = [];
    this.page = null;
    this.intervadId = null;
    this.period = 5;
    this.publishChannel = null;
    this.subscriptionChannel = null;
    this.goPrime = null;
    this.goBackup = null;
    this.reporting = null;
    this.commandResult = null;
    this.worker = null;
    this.getPage = function() {
        return this.page;
    }
    this.register = function(description = '', goPrime = null, goBackup = null, reporting = null, commandResult = null, heartbeatPeriod = 5) {
        if(!self.page) {
            self.page = new pageContext(description);
            self.goPrime = goPrime;
            self.goBackup = goBackup;
            self.reporting = reporting;
            self.commandResult = commandResult;
            self.period = heartbeatPeriod;
            self.subscriptionChannel = new BroadcastChannel('failover');
            self.subscriptionChannel.onmessage = function(ev) {
                let command = ev.data[0];
                let pageID = ev.data[1];
                switch(command) {
                    case helloMessage: self.worker.port.postMessage([self.page.getStatus(), self.page.getID()]);
                    case goPrimeMessage:
                        {
                            let page = self.page;
                            if(page && page.getID() == pageID && page.getStatus() != iAmPrimeMessage) {
                                page.setStatus(iAmPrimeMessage);
                                if(typeof self.goPrime == 'function') {
                                    self.goPrime();
                                }
                            }
                        }
                        break;
                    case goBackupMessage:
                        {
                            let page = self.page;
                            if(page && page.getID() && page.getStatus() != iAmBackupMessage) {
                                page.setStatus(iAmBackupMessage);
                                if(typeof self.goBackup == 'function') {
                                    self.goBackup();
                                }
                            }
                        }
                        break;
                    default:
                        break;
                }
            }
            self.worker = new SharedWorker(url, 'Failover');
            self.worker.onerror = function(error) {
                console.log('Worker error:');
                console.log(error);
            }
            self.worker.port.onmessage = function(e) {
                let command = e.data[0];
                let args = e.data[1];
                switch(command) {
                    case reportingCommand: {
                        console.log('reporting failover:');
                        console.log(args);
                        if(typeof self.reporting == 'function') {
                            self.reporting(args);
                        }
                    }
                    default:
                        break;
                }
                if(typeof self.commandResult == 'function') {
                    self.commandResult(command,args);
                }
            }
            self.worker.port.onmessageerror = function(error) {
                console.log('Worker message error:');
                console.log(error);
            }
            self.worker.port.start();
            self.worker.port.postMessage([registerCommand, self.page.getID(), {
                period: heartbeatPeriod,
                description: description
            }]);      
            return true;
        } else {
            return false;
        }
    }
    this.unregister = function()
    {
        if(self.page) {
            self.subscriptionChannel.close();
            self.subscriptionChannel = null;
            self.worker.port.postMessage([unregisterCommand, self.page.getID()]);
            self.worker.port.close();
            self.worker = null;
            self.page = null;
            return true;
        } else {
            return false;
        }
    }
    this.setPrime = function()
    {
        if(self.worker) {
            self.worker.port.postMessage([goPrimeMessage, self.page.getID()]);
        }
    }
    this.setBackup = function()
    {
        if(self.worker) {
            self.worker.port.postMessage([goBackupMessage, self.page.getID()]);
        }
    }
    this.getReporting = function()
    {
        if(self.worker) {
            self.worker.port.postMessage([reportingCommand]);
        }
    }
    this.handleRegisterCommand = function(pageID, description, period) {
        self.pages[pageID] = new pageContext(description, pageID);
        self.startHeartbeat(period);
        return 'registered';
    }
    this.handleUnregisterCommand = function(pageID) {
        let page = self.pages[pageID]
        if(page) {
            delete pages[pageID];
            if(page.isPrime()) {
                this.selectPrime();
            }
            if(self.pages.keys().length == 0) {
                self.stopHeartbeat();
            }
        }
    }
    this.handleCommand = function(command, pageID, args) {
        switch(command) {
            case registerCommand:
                return this.handleRegisterCommand(pageID, args.description, args.period);
            case unregisterCommand:
                return this.handleUnregisterCommand(pageID);
            case iAmBackupMessage: 
            case iAmPrimeMessage:
                return this.handleStatusMessage(pageID, command);
            case goPrimeMessage:
                return this.handleGoPrimeMessage(pageID);
            case goBackupMessage:
                return this.handleGoBackupMessage(pageID);
            case reportingCommand:
                return this.handleReportingCommand();
            default:
                return 'unknown command';
        }
    }
    this.handleStatusMessage = function(pageID, status) {
        let page = self.pages[pageID];
        if(page) {
            page.setStatus(status);
            return 'set page status';
        } else {
            return 'no such page';
        }
    }
    this.handleGoPrimeMessage = function(pageID) {
        let page = self.pages[pageID];
        if(page && page.getStatus() != iAmPrimeMessage) {
            let primes = this.getPrimes();
            primes.forEach((prime) => {
                self.publishChannel.postMessage([goBackupMessage, prime]);
                self.pages[prime].setStatus(iAmBackupMessage);
            })
            page.setStatus(iAmPrimeMessage);
            self.publishChannel.postMessage([goPrimeMessage, pageID]);
            return iAmPrimeMessage;
        }
        return 'page does not exist or is already prime';
    }
    this.handleGoBackupMessage = function(pageID) {
        let page = self.pages[pageID];
        if(page && page.getStatus() != iAmBackupMessage) {
            self.publishChannel.postMessage([goBackupMessage, pageID]);
            self.pages[pageID].setStatus(iAmBackupMessage);
            return iAmBackupMessage;
        }
        return 'page does not exist or is already backup';
    }
    this.startHeartbeat = function(period) {
        if(!self.intervalId) {
            self.publishChannel = new BroadcastChannel('failover');
            self.intervalId = setInterval( self.heartbeat, period * 1000);
        }
    }
    this.stopHeartbeat = function() {
        if(self.intervalId) {
            clearInterval(self.intervadId);
            self.intervadId = null;
            self.publishChannel.close();
            self.publishChannel = null;
        }
    }
    this.heartbeat = function() {
        self.purgeDeadPages();
        self.selectPrime();
        self.ping();
    }
    this.purgeDeadPages = function() {
        for(var pageID in this.pages) {
            let page = this.pages[pageID];
            if(page && page.isExpired(self.period)) {
                delete this.pages[pageID];
            }
        }
    }
    this.selectPrime = function() {
        let primes = this.getPrimes();
        if(primes.length == 0) {
            let backups = this.getBackups();
            if(backups.length > 0) {
                let newPrime = backups.length == 1 ? backups[0] : backups[Math.floor(Math.random() * backups.length)];
                this.goPrime(newPrime);
                self.pages[newPrime].setStatus(iAmPrimeMessage);
            }
        } else if(primes.length > 1) {
            let newPrime = primes[Math.floor(Math.random() * primes.length)];
            primes.forEach((prime) => {
                if(prime != newPrime) {
                    this.goBackup(prime);
                    self.pages[prime].setStatus(iAmBackupMessage);
                }
            });
        }
    }
    this.getPrimes = function() {
        let primes = [];
        for(pageID in self.pages) {
            let page = self.pages[pageID];
            if(page && page.getStatus() == iAmPrimeMessage) {
                primes.push(pageID);
            }
        }
        return primes;
    }
    this.getBackups = function() {
        let backups = [];
        for(pageID in self.pages) {
            let page = self.pages[pageID];
            if(page && page.getStatus() == iAmBackupMessage) {
                backups.push(pageID);
            }
        }
        return backups;
    }
    this.ping = function() {
        for(pageID in self.pages) {
            let page = self.pages[pageID];
            if(page) {
                page.setCheckStamp();
            }
        }
        self.publishChannel.postMessage([helloMessage, null]);
    }
    this.goPrime = function(pageID) {
        self.publishChannel.postMessage([goPrimeMessage, pageID]);
    }
    this.goBackup = function(pageID) {
        self.publishChannel.postMessage([goBackupMessage, pageID]);
    }
    this.handleReportingCommand = function() {
        return self.pages;
    }
    return this;
}).apply({});