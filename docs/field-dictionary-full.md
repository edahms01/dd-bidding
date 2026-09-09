# Field Dictionary (full)

_Generated from `src/state/fieldRegistry.js` by `scripts/generate-field-dictionary.mjs` — do not edit by hand._

## Project (project)

### project.name
- **Label:** Project name
- **Description:** The name of the job being bid. Identifies this bid in history and on the agent summary.
- **consumedBy:** agent

### project.gc
- **Label:** General contractor
- **Description:** The general contractor inviting the bid. Used to pull up past history with that GC and to weigh relationship and payment risk.
- **consumedBy:** agent

### project.bidDate
- **Label:** Bid due date
- **Description:** The date the completed bid is due to the GC. Frames how much time is left to refine the numbers.
- **consumedBy:** agent

### project.address
- **Label:** Project address
- **Description:** Street address of the job site. Kept for the record only; it does not affect pricing.
- **consumedBy:** display-only

### project.buildingType
- **Label:** Building type
- **Description:** The kind of building, such as office, retail, or healthcare. Helps the agent compare this job to similar past work.
- **consumedBy:** agent

### project.drawingsRef
- **Label:** Drawing set reference
- **Description:** Which drawing set and revision the takeoff was done from. Reference only, so a newer revision can be spotted later.
- **consumedBy:** display-only

### project.startDate
- **Label:** Estimated start date
- **Description:** When work is expected to begin on site. Feeds the season and schedule-risk read.
- **consumedBy:** agent

### project.durationWeeks
- **Label:** Duration (weeks)
- **Description:** Expected job length in weeks. Drives waste-disposal cost, which is billed per month on site, and the agent schedule read.
- **consumedBy:** both
- **calcToken:** durationWeeks

### project.floors
- **Label:** Number of floors
- **Description:** How many floors the work covers. A rough measure of job size and how much the work repeats.
- **consumedBy:** agent

### project.scope
- **Label:** Scope inclusions
- **Description:** Which parts of the work are included in this bid, such as metal framing, drywall, or plastering. Tells the agent what is and is not priced.
- **consumedBy:** agent

### project.exclusions
- **Label:** Exclusions / notes
- **Description:** A written list of what the bid deliberately leaves out, plus any qualifying notes. Protects against being held to work that was never priced.
- **consumedBy:** agent

## Site Conditions (conditions)

### conditions.maxHt
- **Label:** Max ceiling height
- **Description:** The tallest ceiling height on the job, in feet. Sets whether high-work adders and lift rental come into play.
- **consumedBy:** agent

### conditions.sfAbove12
- **Label:** SF above 12 ft
- **Description:** Square footage of board that sits between 12 and 20 feet up. Priced with a labor uplift and triggers lift rental.
- **consumedBy:** both

### conditions.sfAbove20
- **Label:** SF above 20 ft
- **Description:** Square footage of board above 20 feet. Priced with a larger labor uplift that stacks on top of the 12-foot one.
- **consumedBy:** both

### conditions.curvedWalls
- **Label:** Curved walls
- **Description:** Whether the job has any curved wall work. Curved framing and board are slower, so this is flagged to the agent.
- **consumedBy:** agent

### conditions.curvedWallsLF
- **Label:** Curved wall length
- **Description:** Linear feet of curved wall, entered when curved walls is set to yes.
- **consumedBy:** agent

### conditions.exteriorExposure
- **Label:** Exterior exposure
- **Description:** Whether crews will be working exposed to the weather. A job-wide risk signal to the agent, separate from the per-assembly exterior flag.
- **consumedBy:** agent

### conditions.phasedWork
- **Label:** Phased work
- **Description:** Whether the GC is releasing the work in separate phases rather than all at once. Phasing adds remobilization cost and coordination risk.
- **consumedBy:** agent

### conditions.phaseCount
- **Label:** Number of phases
- **Description:** How many separate phases the work is broken into, entered when phased work is set to yes.
- **consumedBy:** agent

### conditions.accessDifficulty
- **Label:** Access difficulty
- **Description:** Whether getting crews and material to the work area is normal or restricted. Restricted access slows production.
- **consumedBy:** agent

### conditions.parking
- **Label:** Parking / unloading
- **Description:** Whether on-site parking and an unloading zone are available or restricted. Affects how much daily labor is lost to hauling material.
- **consumedBy:** agent

### conditions.wastePct
- **Label:** Waste factor override
- **Description:** Job-wide extra board material bought to cover offcuts and damage, as a percent. Blank means 10 percent; individual assemblies can override it.
- **consumedBy:** both

### conditions.trips
- **Label:** Estimated delivery trips
- **Description:** How many material deliveries the job will need. Multiplied by the delivery rate to get delivery cost.
- **consumedBy:** calculator

## Assemblies (assemblies)

### assemblies.id
- **Label:** Assembly type ID
- **Description:** Short code for this wall or ceiling system, like W1 or C2. Each wall and ceiling row references it to pull in the assembly makeup.
- **consumedBy:** both

### assemblies.category
- **Label:** Category
- **Description:** Whether this assembly is a wall or a ceiling. Sets which takeoff table references it and drives the auto-generated type ID.
- **consumedBy:** agent

### assemblies.studSize
- **Label:** Stud size
- **Description:** Width of the metal studs in this assembly. Picks the matching stud material price.
- **consumedBy:** both

### assemblies.layers
- **Label:** Board layers
- **Description:** How many layers of gypsum board per face. Multiplies the hanging labor and the board material for this assembly.
- **consumedBy:** both

### assemblies.boardType
- **Label:** Board type
- **Description:** The kind of gypsum board: standard, Type-X, moisture, or impact. Picks the matching board material price.
- **consumedBy:** both

### assemblies.fireRating
- **Label:** Fire rating
- **Description:** The fire-resistance rating of this assembly. Captured for the record and the agent; not currently used in a cost formula.
- **consumedBy:** agent

### assemblies.acoustic
- **Label:** Acoustic
- **Description:** Whether this assembly carries acoustic insulation. When set to yes, adds insulation material cost (net square footage times the insulation rate); no labor is added.
- **consumedBy:** both

### assemblies.finishLevel
- **Label:** Finish level
- **Description:** The finish level, 1 through 5, for this assembly. Picks the matching taping and finishing rate.
- **consumedBy:** both

### assemblies.exteriorWall
- **Label:** Exterior wall
- **Description:** Wall assemblies only. When set to yes, this assembly is priced with the external wall rate instead of the drywall hanging rate.
- **consumedBy:** both

### assemblies.notes
- **Label:** Notes
- **Description:** Free-text notes about this assembly. Passed to the agent; not costed.
- **consumedBy:** agent

### assemblies.wastePctOverride
- **Label:** Waste % override
- **Description:** A waste percent for this assembly alone, replacing the job-wide waste factor when set.
- **consumedBy:** both

## Walls (walls)

### walls.location
- **Label:** Location
- **Description:** Where this run of wall is: floor, area, or zone. Labels the row; not costed.
- **consumedBy:** both

### walls.typeId
- **Label:** Type ID
- **Description:** The assembly type ID this wall run is built from. Pulls in that assembly’s studs, board, layers, and finish.
- **consumedBy:** both

### walls.height
- **Label:** Wall height (ft)
- **Description:** Floor-to-ceiling height of the run, in feet. Used with linear feet to work out board area when entering by dimensions.
- **consumedBy:** both
- **calcToken:** netSF

### walls.lf
- **Label:** LF framing
- **Description:** Linear feet of wall to frame. Drives framing labor and, with height, the board area.
- **consumedBy:** both

### walls.grossSF
- **Label:** Gross SF board
- **Description:** Total board square footage for this run before openings are taken out.
- **consumedBy:** both
- **calcToken:** netSF

### walls.openings
- **Label:** Openings (SF)
- **Description:** Square footage of doors and windows to subtract from gross, giving the net board area that gets priced.
- **consumedBy:** both
- **calcToken:** netSF

### wallsMode
- **Label:** Wall entry mode
- **Description:** Whether wall quantities are entered by dimensions (height and length) or straight as area. Only changes which columns show, not the price.
- **consumedBy:** display-only

## Ceilings (ceilings)

### ceilings.location
- **Label:** Location
- **Description:** Where this ceiling area is: floor, room, or zone. Labels the row; not costed.
- **consumedBy:** both

### ceilings.typeId
- **Label:** Type ID
- **Description:** The assembly type ID this ceiling area is built from. Pulls in that assembly’s makeup.
- **consumedBy:** both

### ceilings.height
- **Label:** Ceiling height (ft)
- **Description:** Height of this ceiling above the floor, in feet. Used for high-work adders when entering by dimensions.
- **consumedBy:** both
- **calcToken:** netSF

### ceilings.grossSF
- **Label:** Gross SF board
- **Description:** Total ceiling board square footage before openings are taken out.
- **consumedBy:** both
- **calcToken:** netSF

### ceilings.soffitLF
- **Label:** Soffit LF
- **Description:** Linear feet of soffit or bulkhead around this ceiling. Captured for the agent; not currently costed.
- **consumedBy:** agent

### ceilings.openings
- **Label:** Openings (SF)
- **Description:** Square footage of light fixtures and diffusers to subtract from gross, giving the net ceiling area that gets priced.
- **consumedBy:** both
- **calcToken:** netSF

### ceilingsMode
- **Label:** Ceiling entry mode
- **Description:** Whether ceiling quantities are entered by dimensions or straight as area. Only changes which columns show, not the price.
- **consumedBy:** display-only

## Rates (rates)

### rates.framing
- **Label:** Metal framing rate
- **Description:** Labor price to install metal stud framing, per linear foot, at standard height. Height adders are applied on top automatically.
- **consumedBy:** calculator

### rates.hanging
- **Label:** Drywall hanging rate
- **Description:** Labor price to hang gypsum board, per square foot, multiplied by the number of board layers in each assembly.
- **consumedBy:** calculator

### rates.extwall
- **Label:** External wall rate
- **Description:** Labor price per square foot that replaces the drywall hanging rate for any wall assembly flagged as exterior.
- **consumedBy:** calculator

### rates.burdenPct
- **Label:** Labor burden %
- **Description:** Payroll taxes, workers comp, and benefits added on top of raw wages, as a percent of labor. Typically 28 to 40 percent.
- **consumedBy:** calculator

### rates.superPct
- **Label:** Supervision %
- **Description:** Foreman cost as a percent of total labor. Typically 6 to 12 percent.
- **consumedBy:** calculator

### rates.finish
- **Label:** Taping + finishing rates
- **Description:** Labor price per square foot to tape and finish board, with one rate per finish level, 1 through 5.
- **consumedBy:** calculator

### rates.adder12Pct
- **Label:** Above 12 ft adder %
- **Description:** Extra labor percent applied to board area between 12 and 20 feet up, where a lift is needed.
- **consumedBy:** calculator

### rates.adder20Pct
- **Label:** Above 20 ft adder %
- **Description:** Extra labor percent applied to board area above 20 feet. Stacks on top of the 12-foot adder.
- **consumedBy:** calculator

### rates.stud
- **Label:** Stud + track prices
- **Description:** Material price per linear foot for studs and track, with one price per stud size.
- **consumedBy:** calculator

### rates.board
- **Label:** Drywall board prices
- **Description:** Material price per square foot for gypsum board, with one price per board type: standard, Type-X, moisture, or impact.
- **consumedBy:** calculator

### rates.tape
- **Label:** Tape + compound rate
- **Description:** Material allowance per finished square foot for joint tape and compound.
- **consumedBy:** calculator

### rates.insul
- **Label:** Insulation rate
- **Description:** Material price per square foot for insulation, applied to assemblies with the acoustic flag set.
- **consumedBy:** calculator

### rates.fasten
- **Label:** Fasteners + adhesive rate
- **Description:** Flat material allowance per square foot for screws, adhesive, and related fasteners.
- **consumedBy:** calculator

### rates.delivery
- **Label:** Delivery rate
- **Description:** Cost per material delivery trip. Multiplied by the estimated number of trips.
- **consumedBy:** calculator

### rates.disposal
- **Label:** Waste disposal rate
- **Description:** Dumpster and haul-off cost per month on site. Multiplied by the job duration in whole months.
- **consumedBy:** calculator

### rates.lift
- **Label:** Lift rental rate
- **Description:** Rental cost per week for a lift. Only charged when there is board area above 12 feet.
- **consumedBy:** calculator

### rateEscalation.stud
- **Label:** Stud price escalation %
- **Description:** Expected price increase over the life of the job for studs and track, per stud size, added on top of the base material price.
- **consumedBy:** calculator

### rateEscalation.board
- **Label:** Board price escalation %
- **Description:** Expected price increase over the life of the job for gypsum board, per board type.
- **consumedBy:** calculator

### rateEscalation.tape
- **Label:** Tape + compound escalation %
- **Description:** Expected price increase over the life of the job for tape and compound.
- **consumedBy:** calculator

### rateEscalation.insul
- **Label:** Insulation escalation %
- **Description:** Expected price increase over the life of the job for insulation.
- **consumedBy:** calculator

### rateEscalation.fasten
- **Label:** Fasteners escalation %
- **Description:** Expected price increase over the life of the job for fasteners and adhesive.
- **consumedBy:** calculator

### markupInputs.overheadPct
- **Label:** Company overhead %
- **Description:** Office, insurance, and fleet cost added as a percent of direct cost. The first of the three markups that turn cost into price.
- **consumedBy:** calculator

### markupInputs.contingencyPct
- **Label:** Risk / contingency %
- **Description:** The estimator’s own buffer for this job, as a percent. Starts blank and is a purely manual judgement call.
- **consumedBy:** calculator

### markupInputs.profitPct
- **Label:** Profit margin %
- **Description:** Target profit taken on top of direct cost and overhead. The last markup applied before the bid price.
- **consumedBy:** calculator

## Cost Summary (output)

_No fields are entered on this tab._

## Market Read (market)

### conditions.confidence
- **Label:** Estimator confidence
- **Description:** How sure the estimator is about the takeoff overall: high, medium, or low. Signals to the pricing agent how much risk buffer the bid should carry.
- **consumedBy:** agent

### conditions.notes
- **Label:** Estimator notes
- **Description:** Free-text gut feel: GC history, site concerns, anything not captured in the structured fields. Passed to the agent as context.
- **consumedBy:** agent

### intelligence.crewAvailability
- **Label:** Crew availability
- **Description:** How booked Dirigo's crews are right now. Tight availability pushes the target margin up.
- **consumedBy:** agent

### intelligence.pipelinePressure
- **Label:** Pipeline pressure
- **Description:** How badly Dirigo needs this job given the rest of the pipeline. A direct signal on how aggressive to price.
- **consumedBy:** agent

### intelligence.materialTrend
- **Label:** Material price trend
- **Description:** Whether material prices are rising, stable, or falling. A rising trend may warrant rate escalation or more contingency.
- **consumedBy:** agent

### intelligence.gcRelationship
- **Label:** GC relationship
- **Description:** How strong the working relationship with this GC is. Strong relationships lower payment risk and can justify a tighter margin.
- **consumedBy:** agent

### intelligence.gcPriceSensitivity
- **Label:** GC price sensitivity
- **Description:** Whether this GC always takes the lowest number or will pay for quality. Sets how much margin the market will bear.
- **consumedBy:** agent

### intelligence.competitionLevel
- **Label:** Competition level
- **Description:** How many other firms are expected to bid. More competition means a tighter spread between winning and losing.
- **consumedBy:** agent

### intelligence.knownCompetitors
- **Label:** Known competitors
- **Description:** Names of the other firms expected to bid. Logged for win-rate pattern analysis; not used in the current calculation.
- **consumedBy:** agent

### intelligence.dirigoEdge
- **Label:** Dirigo's edge
- **Description:** The estimator’s read on how well Dirigo fits this job versus competitors. A strong edge supports premium pricing.
- **consumedBy:** agent

## Bid Strategy (agent)

_No fields are entered on this tab._
