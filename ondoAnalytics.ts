// https://finnhub.io/api/v1/stock/tick?symbol=AAPL&date=2021-03-09&limit=500&skip=0&format=json&token=d6u3omhr01qp1k9b4260d6u3omhr01qp1k9b426g
const APIKEY = 'd6u3omhr01qp1k9b4260d6u3omhr01qp1k9b426g'
const SPYON = '0xFeDC5f4a6c38211c1338aa411018DFAf26612c08'

async function getStockPrice() {
    try {

        console.log('getting stockprice')
        const res = await fetch(`https://finnhub.io/api/v1/quote?symbol=SPY&format=JSON&token=${APIKEY}`)
        
        const json = await res.json()
    
        console.log('json', json.c)
    } catch (e) {

        console.log('error', e)
    }
}

getStockPrice()