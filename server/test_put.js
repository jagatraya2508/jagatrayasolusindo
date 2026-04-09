async function testUpdate() {
   const res = await fetch('http://localhost:3001/api/gl-settings', {
       method: 'PUT',
       headers: { 'Content-Type': 'application/json' },
       body: JSON.stringify({
           entity_code: "02",
           settings: {
               "inventory_account": 1,
               "pb1_account": 3
           }
       })
   });
   const data = await res.json();
   console.log(data);
}
testUpdate();
