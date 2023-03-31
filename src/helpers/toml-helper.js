import json2toml from 'json2toml';

export const stringifyToml = (json) => {
    // Checks the JSON to see if there are any null values 
    Object.entries(json).forEach(([key, value]) => {
        if(value === null){
            json[key] = '';
        }
      });
      
let tomlConversion = json2toml(
    json
)

return tomlConversion

}
  
