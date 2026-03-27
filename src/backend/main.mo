import Outcall "http-outcalls/outcall";

persistent actor {

  // Required transform for HTTP outcalls — strips headers for consensus
  public query func transform(input : Outcall.TransformationInput) : async Outcall.TransformationOutput {
    Outcall.transform(input)
  };

  // Fetch all BingX spot trading pairs — bypasses browser CORS
  public func getBingXSymbols() : async Text {
    try {
      await Outcall.httpGetRequest(
        "https://open-api.bingx.com/openApi/spot/v1/common/symbols",
        [],
        transform
      )
    } catch (_e) {
      "{\"error\":\"fetch failed\"}"
    }
  };

  // Fetch CoinGecko market page — bypasses browser CORS/rate-limits
  public func getCoinGeckoPage(page : Nat) : async Text {
    let pageStr = switch (page) {
      case 1 { "1" }; case 2 { "2" }; case 3 { "3" }; case 4 { "4" };
      case 5 { "5" }; case 6 { "6" }; case 7 { "7" }; case 8 { "8" };
      case 9 { "9" }; case 10 { "10" }; case 11 { "11" }; case 12 { "12" };
      case 13 { "13" }; case 14 { "14" }; case 15 { "15" }; case 16 { "16" };
      case 17 { "17" }; case 18 { "18" }; case 19 { "19" }; case _ { "20" };
    };
    try {
      await Outcall.httpGetRequest(
        "https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=volume_desc&per_page=100&page=" # pageStr # "&sparkline=false",
        [],
        transform
      )
    } catch (_e) {
      "[]"
    }
  };

}
