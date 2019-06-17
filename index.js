// IIFE - Immediately Invoked Function Expression
(function (code) {

    // The global jQuery object is passed as a parameter
    code(window.jQuery, window, document);

}(function ($, window, document) {

    // The $ is now locally scoped

    // Listen for the jQuery ready event on the document
    $(async function (format, data) {

        /*
        * ASSUMPTIONS
        * **Only 100 data points at a time on the graph
        * **Removes data point when new one is added
        * */

        console.log('The DOM is ready');

        await initCharts()


        console.log(window.data)

        initWebSockets()
        setInterval(
            () => {

            }, 500)
    });

    let config = {
        headers: {"x-api-key": "UAK000000000000000000000000demo0001"}
    }

    const getHistoricalOHLCV = (pair) => axios.get(`https://web3api.io/api/v1/market/ohlcv/${pair}/historical`, config)

    let hasReceivedData = false

    /* Demo key - Get your API Key at amberdata.io/pricing
    * and place yours here! */
    let initWebSockets = () => {

        // Create WebSocket connection.
        const socket = new WebSocket('wss://ws.web3api.io?x-api-key=UAK000000000000000000000000demo0001');

        // Connection opened
        socket.addEventListener('open', function (event) {
            console.log('Connection opened - ', event);
            const pair = "eth_btc"
            socket.send(`{"jsonrpc":"2.0","id":0,"method":"subscribe","params":["market:orders",{"pair":"${pair}","exchange":"gdax"}]}`);

            setTimeout(() => {
                if(!hasReceivedData)
                    socket.send(`{"jsonrpc":"2.0","id":0,"method":"subscribe","params":["market:orders",{"pair":"${pair}","exchange":"gdax"}]}`);
            }, 5000)
        });

        // Listen for messages
        socket.addEventListener('message', responseHandler);

        // Listen for messages
        socket.addEventListener('close', function (event) {
            console.log('Connection closed - ', event);
            initWebSockets()
        });
    }

    const PRICE = 3, VOLUME = 4, ISBID = 5;

    const extractData = (data) => data.data.payload

    let bidCount = 0 , askCount = 0, removeOrderCount = 0;

    /**
     * Manages Websocket subscriptions.
     */
    const responseHandler = (wsEvent) => {
        // add to queue
        hasReceivedData = true
        const raw_data = JSON.parse(wsEvent.data)
        let data

        // It's a subscription response or error either way bail out
        if (!raw_data.params) return

        // Grab the data from the param 'result'
        data = toDataObject(raw_data.params.result[0])

        let range = {
            head: data.isBid? 0 : parseInt(window.chart.data.length / 2),
            tail: data.isBid ? parseInt(window.chart.data.length / 2)  : window.chart.data.length,
        }


        let totalVolumeKey = data.isBid ? 'bidstotalvolume' : 'askstotalvolume'
        let volumeKey = data.isBid ? 'bidsvolume' : 'asksvolume'

        let priceIndex = indexOfPrice(data.price, range.head, range.tail)

        let removeOrder = data.volume === 0

        let op = data.isBid ? '--' : '++'
        let comp = data.isBid ? '>=' : '<'
        let limit = data.isBid ? range.head : range.tail

        if (priceIndex >= 0) { // update existing price

            let volume = data.volume

            // If removeOrder (order is a volume of 0) then
            if (removeOrder) {

                // get volume at that price
                volume = window.chart.data[priceIndex][volumeKey]

            } else {
                window.chart.data[priceIndex][volumeKey] += volume
            }


            // subtract volume from all prices greater than the price index

            // updateCulmVolume()
            for(let i = priceIndex; eval(`i${comp}${limit}`); eval(`i${op}`)) {
                window.chart.data[i][totalVolumeKey] += ( volume * (removeOrder ? -1 : 1) )
            }

            // Refresh the chart with updated data
            if (removeOrder) {
                // remove price from data
                window.chart.data.splice(priceIndex, 1)
                window.chart.invalidateData();
            }
            else {
                window.chart.invalidateRawData();
            }

        } else { // add new price entry
            // l(`add new price entry - `, data.price)
            // get the index of the new price
            let newPriceIndex = indexOfNewPrice(data.price, range.head, range.tail)
            // //
            // window.chart.data.splice(newPriceIndex, 0 /*<- no delete*/,
            //     {
            //         value: data.price,
            //         [volumeKey] : data.volume,
            //         [totalVolumeKey]: data.volume + window.chart.data[newPriceIndex + (data.isBid ? 1 : -1)]
            //     })
            //
            // // updateCulmVolume
            // for(let i = newPriceIndex + (data.isBid ? -1 : 1); eval(`i${comp}${limit}`); eval(`i${op}`)) {
            //     window.chart.data[i][totalVolumeKey] += data.price
            // }

        }
    }

    const updateCulmVolume = (index, head, tail, isBid, removeOrder) => {
        let op = isBid ? '--' : '++'
        let comp = isBid ? '>=' : '<'
        let limit = isBid ? range.head : range.tail
        for(let i = priceIndex; eval(`i${comp}${limit}`); eval(`i${op}`)) {
            window.chart.data[i][totalVolumeKey] += ( volume * (removeOrder ? -1 : 1) )
        }
    }

    /**
     * Get's the index of the price in the array within a given range
     * @param price the price ot get the index of
     * @param head the start of the range
     * @param tail the end of the range (exclusive)
     * @return -1 if not found or the price's index in the array
     */
    const indexOfPrice = (price, head=0, tail=window.chart.length) => {
        let priceIndex = -1
        // console.log(`indexOfPrice`, {head, tail})
        for (let i = head; i < tail && priceIndex < 0; i++) {
            if (!window.chart.data[i]) {
                console.log(`data[${i}] is undef`)
            }
            if (window.chart.data[i].value === price) {
                priceIndex = i
            }
        }
        return priceIndex
    }

    const indexOfNewPrice = (price, head=0, tail=window.chart.length) => {
        let priceIndex = -1
        for (let i = head; i < tail && priceIndex < 0; i++) {
            if (window.chart.data[i].value > price) {
                priceIndex = i
            }
        }
        return priceIndex
    }

    let toDataObject = (dataArray) => (
        {exchange: dataArray[0], timestamp: dataArray[1], millis: dataArray[2],
            price: dataArray[3], volume: dataArray[4], isBid: dataArray[5]} )


    const initCharts = async () => {
        am4core.ready(function() {

            // Themes begin
            am4core.useTheme(am4themes_animated);
            // Themes end

            // Create chart instance
            var chart = am4core.create("chart--depth", am4charts.XYChart);

            // Add data
            chart.dataSource.requestOptions.requestHeaders = [{
                "key": "x-api-key",
                "value": "UAK000000000000000000000000demo0001"
            }];
            chart.dataSource.url = `https://web3api.io/api/v1/market/orders/eth_btc?exchange=gdax&timestamp=${new Date().getTime() - 3600000.00}`;
            chart.dataSource.adapter.add("parsedData", function(data) {

                // Function to process (sort and calculate cumulative volume)
                function processData(list, type, desc) {
                    // Convert to data points
                    for(var i = 0; i < list.length; i++) {
                        list[i] = {
                            value: Number(list[i][0]),
                            volume: Number(list[i][1]),
                        }
                    }

                    // Sort list just in case
                    list.sort(function(a, b) {
                        if (a.value > b.value) {
                            return 1;
                        }
                        else if (a.value < b.value) {
                            return -1;
                        }
                        else {
                            return 0;
                        }
                    });

                    // Calculate cummulative volume
                    if (desc) {
                        for(var i = list.length - 1; i >= 0; i--) {
                            if (i < (list.length - 1)) {
                                list[i].totalvolume = list[i+1].totalvolume + list[i].volume;
                            }
                            else {
                                list[i].totalvolume = list[i].volume;
                            }
                            var dp = {};
                            dp["value"] = list[i].value;
                            dp[type + "volume"] = list[i].volume;
                            dp[type + "totalvolume"] = list[i].totalvolume;
                            res.unshift(dp);
                        }
                    }
                    else {
                        for(var i = 0; i < list.length; i++) {
                            if (i > 0) {
                                list[i].totalvolume = list[i-1].totalvolume + list[i].volume;
                            }
                            else {
                                list[i].totalvolume = list[i].volume;
                            }
                            var dp = {};
                            dp["value"] = list[i].value;
                            dp[type + "volume"] = list[i].volume;
                            dp[type + "totalvolume"] = list[i].totalvolume;
                            res.push(dp);
                        }
                    }
                }
                $('.loader').css('opacity', '0')
                // Init
                var res = [];
                processData(data.payload.data.bid, "bids", true);
                processData(data.payload.data.ask, "asks", false);
                console.log(res)

                window.data = new SortedMap(res.map( entry => [entry.value, entry]))
                // window.data = res
                return res;
            });

            // Set up precision for numbers
            chart.numberFormatter.numberFormat = "#,###.####";

            // Create axes
            var xAxis = chart.xAxes.push(new am4charts.CategoryAxis());
            xAxis.dataFields.category = "value";
            //xAxis.renderer.grid.template.location = 0;
            xAxis.renderer.minGridDistance = 50;
            xAxis.title.text = "Price (ETH/BTC)";
            xAxis.interpolationDuration = 500;

            var yAxis = chart.yAxes.push(new am4charts.ValueAxis());
            yAxis.title.text = "Volume";
            yAxis.interpolationDuration = 500;

            // Create series
            var series = chart.series.push(new am4charts.StepLineSeries());
            series.dataFields.categoryX = "value";
            series.dataFields.valueY = "bidstotalvolume";
            series.strokeWidth = 2;
            series.stroke = am4core.color("#0f0");
            series.fill = series.stroke;
            series.fillOpacity = 0.1;
            series.tooltipText = "Bid: [bold]{categoryX}[/]\nTotal volume: [bold]{valueY}[/]\nVolume: [bold]{bidsvolume}[/]"
            series.interpolationDuration = 500;

            var series2 = chart.series.push(new am4charts.StepLineSeries());
            series2.dataFields.categoryX = "value";
            series2.dataFields.valueY = "askstotalvolume";
            series2.strokeWidth = 2;
            series2.stroke = am4core.color("#f00");
            series2.fill = series2.stroke;
            series2.fillOpacity = 0.1;
            series2.tooltipText = "Ask: [bold]{categoryX}[/]\nTotal volume: [bold]{valueY}[/]\nVolume: [bold]{asksvolume}[/]"
            series2.interpolationDuration = 500;

            var series3 = chart.series.push(new am4charts.ColumnSeries());
            series3.dataFields.categoryX = "value";
            series3.dataFields.valueY = "bidsvolume";
            series3.strokeWidth = 0;
            series3.fill = am4core.color("#000");
            series3.fillOpacity = 0.2;
            series3.interpolationDuration = 500;

            var series4 = chart.series.push(new am4charts.ColumnSeries());
            series4.dataFields.categoryX = "value";
            series4.dataFields.valueY = "asksvolume";
            series4.strokeWidth = 0;
            series4.fill = am4core.color("#000");
            series4.fillOpacity = 0.2;
            series4.interpolationDuration = 500;

            // Add cursor
            chart.cursor = new am4charts.XYCursor();
            window.chart = chart
        }); // end am4core.ready()

        const data = extractData(await getHistoricalOHLCV('eth_btc')).data
        // split the data set into ohlc and volume
        var ohlc = [],
            volume = [],
            dataLength = data.bitfinex.length,
            // set the allowed units for data grouping
            groupingUnits = [[
                'week',                         // unit name
                [1]                             // allowed multiples
            ], [
                'month',
                [1, 2, 3, 4, 6]
            ]],
            i = 0;

        for (i; i < dataLength; i += 1) {
            ohlc.push([
                data.bitfinex[i][0], // the date
                data.bitfinex[i][1], // open
                data.bitfinex[i][2], // high
                data.bitfinex[i][3], // low
                data.bitfinex[i][4] // close
            ]);

            volume.push([
                data.bitfinex[i][0], // the date
                data.bitfinex[i][5] // the volume
            ]);
        }
        // create the chart
        Highcharts.stockChart('chart--ohlcv', {

            rangeSelector: {
                selected: 1
            },

            title: {
                text: 'ETH / BTC Historical'
            },

            yAxis: [{
                labels: {
                    align: 'right',
                    x: -3
                },
                title: {
                    text: 'OHLC'
                },
                height: '60%',
                lineWidth: 2,
                resize: {
                    enabled: true
                }
            }, {
                labels: {
                    align: 'right',
                    x: -3
                },
                title: {
                    text: 'Volume'
                },
                top: '65%',
                height: '35%',
                offset: 0,
                lineWidth: 2
            }],

            tooltip: {
                split: true
            },

            series: [{
                type: 'candlestick',
                name: 'AAPL',
                data: ohlc,
                dataGrouping: {
                    units: groupingUnits
                }
            }, {
                type: 'column',
                name: 'Volume',
                data: volume,
                yAxis: 1,
                dataGrouping: {
                    units: groupingUnits
                }
            }]
        });

    }

}));
