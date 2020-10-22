const puppeteer = require('puppeteer')
const fs = require('fs')
const retry = require('async-retry')
const nodemailer = require('nodemailer')
const dateObj = new Date()
const actualMonth = dateObj.getUTCMonth() + 1
let actualDay = dateObj.getUTCDate() 
const actualYear = dateObj.getUTCFullYear()

const processParams = {
    identidad: process.argv[2],
    email_addresses: process.argv[3],
    email_password: process.argv[4],
    email_toSend: process.argv[5]

}

const main = async () => {
    try {
      // preparo el navegador e ingreso al sistema
      await retry(async bail => {
        // if anything throws, we retry
        await preparePage()
      }, {
        retries: 5,
        onRetry: async err => {
          console.log(err)
          console.log('Retrying...')
          await page.close()
          await browser.close()
        }
      })
      console.log('primer try...')
      let identidad = processParams.identidad
      const processResult = await processDataRequest(identidad)
      if (processResult == true){
        const resultData = await dataOutput(identidad)
        await sendResultConciliacionEmail(identidad,resultData)
      }
      //logSuccessAndExit(processResult)
    } catch (err) {
      logErrorAndExit(err)
    }
  }

  
const preparePage = async () => {
    browser = await puppeteer.launch({
      headless: true,
      //headless: true,
      args: [
        '--no-sandbox',
        '--disable-features=site-per-process',
        '--disable-gpu',
        '--window-size=1920x1080',
      ]
    })
    viewPort = {
      width: 1300,
      height: 900
    }
    const URL_OFFSHORE = 'https://offshoreleaks.icij.org/'

    page = await browser.newPage()
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/72.0.3626.109 Safari/537.36');
    await page.setViewport(viewPort)
    await page.setDefaultNavigationTimeout(20000)
    await page.setDefaultTimeout(20000)
    await page.goto(URL_OFFSHORE, { waitUntil: 'networkidle0' })
  }

const processDataRequest = async (identidad) => {
      
    await page.waitForSelector('#modal_terms > form > div > label')
    await page.click('#modal_terms > form > div > label')
    await page.waitForSelector('input[type=submit]')
    await page.click('input[type=submit]')

    await page.waitForSelector('#q')
    await page.type('#q',identidad)

    await page.waitForSelector('input[type=submit]')
    await page.click('input[type=submit]')
    
    await page.waitForSelector('#modal-donate-timebomb > button')
    await page.click('#modal-donate-timebomb > button')    


    return true
  
  }
const dataOutput = async (identidad) => {

    let regExp = /\(([^)]+)\)/
    const elementSelector = '#results_wrapper > ul > li:nth-child(1)'
    const offshoreEntities = await page.$eval(elementSelector, (uiElement) => {
      return uiElement.innerText;
    })
    const matchesEntities = regExp.exec(offshoreEntities)
    let datosExtraidosdeLaCuenta = {
      offshoreEntities :[],
      officers :[],
      intermediaries:[],
      adresses : [],
      others : [],
    }


    await page.screenshot({path: __dirname+'/download/'+'entidad-'+identidad+'.png',fullPage: true })



    if(matchesEntities[1] !== '0'){
        let cantidadDeEntidades = (await page.$$('#search_results > table > tbody > tr')).length 
        for (let index = 2; index < cantidadDeEntidades+1; index++) {
            //#search_results > table > tbody > tr:nth-child(2) > td.description
            let Entities = await page.$$(`#search_results > table > tbody > tr:nth-child(${index}) > td.description`)
            let EntitiesName = await page.evaluate(Entities => Entities.innerText, Entities[0])

            let incorporation = await page.$$(`#search_results > table > tbody > tr:nth-child(${index}) > td.incorporation`)
            let incorporationName = await page.evaluate(incorporation => incorporation.innerText, incorporation[0])
            
            let jurisdiction = await page.$$(`#search_results > table > tbody > tr:nth-child(${index}) > td.jurisdiction`)
            let jurisdictionName = await page.evaluate(jurisdiction => jurisdiction.innerText, jurisdiction[0])
            
            let country = await page.$$(`#search_results > table > tbody > tr:nth-child(${index}) > td.country`)
            let countryName = await page.evaluate(country => country.innerText, country[0])
 
            let source = await page.$$(`#search_results > table > tbody > tr:nth-child(${index}) > td.source`)
            let sourceName = await page.evaluate(source => source.innerText, source[0])

            const resultado_extraido = {
              "Entidad": EntitiesName,
              "Incorporation" : incorporationName,
              "jurisdiction" : jurisdictionName,
              "country" : countryName,
              "source" : sourceName
             }
            datosExtraidosdeLaCuenta.offshoreEntities.push(resultado_extraido)

        }
    }else{
      let sinResultado = "La persona o entidad "+identidad+" no posee ninguna cuenta offshore"
      const resultado_extraido = JSON.stringify({
          "Nombre o Entidad": identidad,
          "Resultado Extraido" : sinResultado
      })
      datosExtraidosdeLaCuenta.push(resultado_extraido)
      fs.appendFileSync(__dirname+'/download/'+'entidad-'+identidad+'.json',datosExtraidosdeLaCuenta)
      return false

    }

    await page.waitForSelector('#results_wrapper > ul > li:nth-child(2)',{visible:true})   
    await page.waitForTimeout(2000)
    
    let officersEntities = await page.$$('#results_wrapper > ul > li:nth-child(2)')
    let officersCant = await page.evaluate(officersEntities => officersEntities.innerText, officersEntities[0])
    const matchesOfficers = regExp.exec(officersCant)
    if(matchesOfficers[1] !== '0'){
        await page.waitForSelector('#results_wrapper > ul > li:nth-child(2)',{visible:true}) 
        await page.click('#results_wrapper > ul > li:nth-child(2)')
        await page.waitForTimeout(5000) 

        let cantidadDeOfficers = (await page.$$('#search_results > table > tbody > tr')).length 
        for (let index = 2; index < cantidadDeOfficers+1; index++) {
            let officers = await page.$$(`#search_results > table > tbody > tr:nth-child(${index}) > td.description`)
            let officersName = await page.evaluate(officers => officers.innerText, officers[0])

            let country = await page.$$(`#search_results > table > tbody > tr:nth-child(${index}) > td.country`)
            let countryName = await page.evaluate(country => country.innerText, country[0])
 
            let source = await page.$$(`#search_results > table > tbody > tr:nth-child(${index}) > td.source`)
            let sourceName = await page.evaluate(source => source.innerText, source[0])

            const resultado_extraido = {
              "officers": officersName,
              "country" : countryName,
              "source" : sourceName
             }
             datosExtraidosdeLaCuenta.officers.push(resultado_extraido)
        }
    }

    let intermediariesEntities = await page.$$('#results_wrapper > ul > li:nth-child(3)')
    let intermediariesCant = await page.evaluate(intermediariesEntities => intermediariesEntities.innerText, intermediariesEntities[0])
    const matchesIntermediaries = regExp.exec(intermediariesCant)
    if(matchesIntermediaries[1] !== '0'){
        await page.waitForSelector('#results_wrapper > ul > li:nth-child(3)',{visible:true}) 
        await page.click('#results_wrapper > ul > li:nth-child(3)')
        await page.waitForTimeout(5000) 

        let cantidadDeIntermediaries = (await page.$$('#search_results > table > tbody > tr')).length 
        for (let index = 2; index < cantidadDeIntermediaries+1; index++) {

            let intermediaries = await page.$$(`#search_results > table > tbody > tr:nth-child(${index}) > td.description`)
            let intermediariesName = await page.evaluate(intermediaries => intermediaries.innerText, intermediaries[0])

            let country = await page.$$(`#search_results > table > tbody > tr:nth-child(${index}) > td.country`)
            let countryName = await page.evaluate(country => country.innerText, country[0])
 
            let source = await page.$$(`#search_results > table > tbody > tr:nth-child(${index}) > td.source`)
            let sourceName = await page.evaluate(source => source.innerText, source[0])

            const resultado_extraido = {
              "intermediaries": intermediariesName,
              "country" : countryName,
              "source" : sourceName
             }

             datosExtraidosdeLaCuenta.intermediaries.push(resultado_extraido)


        }
    }

    let adressesEntities = await page.$$('#results_wrapper > ul > li:nth-child(4)')
    let adressesCant = await page.evaluate(adressesEntities => adressesEntities.innerText, adressesEntities[0])
    const matchesAdresses = regExp.exec(adressesCant)
    if(matchesAdresses[1] !== '0'){
        await page.waitForSelector('#results_wrapper > ul > li:nth-child(4)',{visible:true}) 
        await page.click('#results_wrapper > ul > li:nth-child(4)')
        await page.waitForTimeout(5000) 

        let cantidadDeAdresses = (await page.$$('#search_results > table > tbody > tr')).length 
        for (let index = 2; index < cantidadDeAdresses+1; index++) {
            let adresses = await page.$$(`#search_results > table > tbody > tr:nth-child(${index}) > td.description`)
            let adressesName = await page.evaluate(adresses => adresses.innerText, adresses[0])

            let country = await page.$$(`#search_results > table > tbody > tr:nth-child(${index}) > td.country`)
            let countryName = await page.evaluate(country => country.innerText, country[0])
 
            let source = await page.$$(`#search_results > table > tbody > tr:nth-child(${index}) > td.source`)
            let sourceName = await page.evaluate(source => source.innerText, source[0])
            const resultado_extraido = {
              "adresses": adressesName,
              "country" : countryName,
              "source" : sourceName
             }
             datosExtraidosdeLaCuenta.adresses.push(resultado_extraido)

        }
    }


    let othersEntities = await page.$$('#results_wrapper > ul > li:nth-child(5)')
    let othersCant = await page.evaluate(othersEntities => othersEntities.innerText, othersEntities[0])
    const matchesOthers = regExp.exec(othersCant)
    if(matchesOthers[1] !== '0'){

        await page.waitForSelector('#results_wrapper > ul > li:nth-child(5)',{visible:true}) 
        await page.click('#results_wrapper > ul > li:nth-child(5)')
        await page.waitForTimeout(5000) 

        let cantidadDeOthers = (await page.$$('#search_results > table > tbody > tr')).length 
        for (let index = 2; index < cantidadDeOthers+1; index++) {
            let others = await page.$$(`#search_results > table > tbody > tr:nth-child(${index}) > td.description`)
            let othersName = await page.evaluate(others => others.innerText, others[0])

            let country = await page.$$(`#search_results > table > tbody > tr:nth-child(${index}) > td.country`)
            let countryName = await page.evaluate(country => country.innerText, country[0])
 
            let source = await page.$$(`#search_results > table > tbody > tr:nth-child(${index}) > td.source`)
            let sourceName = await page.evaluate(source => source.innerText, source[0])

            const resultado_extraido = {
              "others": othersName,
              "country" : countryName,
              "source" : sourceName
             }
            datosExtraidosdeLaCuenta.others.push(resultado_extraido)

        }
    }

    let dataJSON = JSON.stringify(datosExtraidosdeLaCuenta)
    fs.writeFileSync(__dirname+'/download/'+'entidad-'+identidad+'.json',dataJSON)
    return true
}

const sendResultConciliacionEmail = async (identidad,resultData) => {
  return new Promise(async (resolve, reject) => {
      try {
          let transporter = getEmailTransporter()
     
          //const attachmentsReport = await readReportFiles(resultAttachments)

          let htmlFinal = '<h3>Tenemos resultados sobre la persona .</h3>'
          htmlFinal += '<p>Se adjunta archivo Json con los resultados obtenido acerca del individuo .</p>'
          htmlFinal += '<p>Hasta la próxima!</p><p>THE EYE BOT</p>'
          let viewIdentidad = identidad
          //console.log(viewIdentidad)
          // setup e-mail data with unicode symbols
          let emailtosend = processParams.email_toSend
      emailtosend = emailtosend.replace(/'/g, "")
          const NO_REPLY_ADDRESS = 'support@theeye.io'
          var mailOptions = {
              from: NO_REPLY_ADDRESS,
              to: emailtosend,
               //cc: 'guidoher@theeye.io',
              subject: 'TheEye - Cuentas Offshore - PROCESO FINALIZADO',
              html: htmlFinal,
              attachments: [
              {
                  filename: 'cuenta-'+viewIdentidad+'.json',
                  path: __dirname+'/download/'+'entidad-'+identidad+'.json'
              },
              {
                filename: 'cuenta-'+viewIdentidad+'.png',
                path: __dirname+'/download/'+'entidad-'+identidad+'.png'
            }
            ]
          }

          // send mail with defined transport object
          transporter.sendMail(mailOptions, function (err, info) {
              if (err) {
                  console.log(err);
                  reject(err)
                  logErrorAndExit()
              } else {
                  console.log('email enviado');  
                  logSuccessAndExit(resultData)
 
              }

          });

      } catch (err) {
          console.log(err)
          reject(err)
      }
  })
}


const getEmailTransporter = () => {
  const EMAIL_HOST = 'smtp.gmail.com'
  let emailadress = processParams.email_addresses
  emailadress = emailadress.replace(/'/g, "")
  const SMTP_EMAIL_USER = emailadress
  let emailpassword = processParams.email_password
  emailpassword = emailpassword.replace(/'/g, "")
  
  const SMTP_EMAIL_PASSWORD = emailpassword

  var transporter = nodemailer.createTransport({
      host: EMAIL_HOST,
      port: '587',
      auth: {
          user: SMTP_EMAIL_USER,
          pass: SMTP_EMAIL_PASSWORD
      },
      secureConnection: false,
      tls: {
          ciphers: 'SSLv3'
      },
      requireTLS: true
  });

  return transporter
}

const logErrorAndExit = error => {
  console.error(JSON.stringify({
    state: 'failure',
    data:[error]
  }))
  process.exit()
}
const logSuccessAndExit = resultData => {
  if(resultData == true){    
    console.log(JSON.stringify({
        state: 'success',
        popup_component: "Se realizó la investigacion de: " + processParams.identidad + ". Los resultados fueron enviados a la casilla de email:  " + processParams.email_toSend       
    }))
    process.exit()
  }
  if(resultData == false){    
    console.log(JSON.stringify({
        state: 'success',
        popup_component: "Se realizó la investigacion de: " + processParams.identidad + " y no se encontraron resultados. "+"Los detalles fueron enviados a la casilla de email:  " + processParams.email_toSend       
    }))
    process.exit()
  }
  browser.close()
}



  main ()