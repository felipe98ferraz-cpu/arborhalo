// Illustrative catalog for this private preview. Replace with confirmed data before sales.
export const config = {
  currency: 'USD',
  preview: true,
  campaign: null,
  bundles: [
    { id:'one', trees:1, title:'One Tree', cents:4999, compareCents:19999, badge:'Start here', description:'Start with one tree as the focal point.' },
    { id:'two', trees:2, title:'Two Trees', cents:8887, compareCents:39998, badge:'Pair it up', description:'Frame an entrance or light a pair of trees.' },
    { id:'four', trees:4, title:'Four Trees', cents:15552, compareCents:79996, badge:'Best value', description:'Bring a larger garden together after dark.' }
  ],
  addons: [
    { id:'priority', title:'Priority Processing', cents:499, icon:'⚡', description:'Move your order up in the processing queue.' },
    { id:'solar', title:'Solar Panel', cents:8999, thumbnail:'feature-solar.png', description:'One solar panel supports up to 7 Lumina Garden segments.' }
  ]
};
